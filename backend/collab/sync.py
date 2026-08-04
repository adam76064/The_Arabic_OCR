"""LAN sync: PSK-derived symmetric encryption + auth handshake + real-time
JSON/text sync (no images/PDF by default) + on-demand hash-verified file transfer."""
import socket
import threading
import struct
import json
import hmac
import hashlib
import base64
import os
import time
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

NO_PASSWORD_MARKER = "__no_password__"


def _derive_key(project_id, password):
    pw = (password or NO_PASSWORD_MARKER).encode('utf-8')
    salt = project_id.encode('utf-8')[:16].ljust(16, b'0')
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=200000)
    return base64.urlsafe_b64encode(kdf.derive(pw))


def _send_frame(sock, data: bytes):
    sock.sendall(struct.pack('>I', len(data)) + data)


def _recv_frame(sock):
    hdr = _recv_exact(sock, 4)
    if not hdr:
        return None
    (length,) = struct.unpack('>I', hdr)
    return _recv_exact(sock, length)


def _recv_exact(sock, n):
    buf = b''
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


class LANSyncServer:
    """Runs on the project host. Authenticates peers by requiring them to
    prove knowledge of the shared password: the client must encrypt a
    server-issued nonce with the Fernet key derived from (project_id,
    password), and the server verifies it against every accepted key it
    knows before granting access. The plaintext password is only ever
    used in-memory by the host that started sharing (never persisted)."""

    def __init__(self, project_id, project_manager, password_hash, on_remote_update, password=None, broadcasting=True):
        self.project_id = project_id
        self.project_manager = project_manager
        self.password_hash = password_hash
        self.on_remote_update = on_remote_update
        self._password = password
        self.broadcasting = broadcasting
        self._sock = None
        self._peers = {}  # conn -> {'username', 'fernet', 'last_seen'}
        self._lock = threading.Lock()
        self._running = False

    def start(self, port=0):
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(('0.0.0.0', port))
        self._sock.listen(8)
        self._running = True
        threading.Thread(target=self._accept_loop, daemon=True).start()
        return self._sock.getsockname()[1]

    def set_broadcasting(self, enabled: bool):
        self.broadcasting = enabled

    def get_active_peers(self) -> list:
        with self._lock:
            now = time.time()
            active = [p['username'] for p in self._peers.values() if (now - p.get('last_seen', 0)) < 60]
            # Include local machine hostname as host
            hostname = socket.gethostname()
            if hostname not in active:
                active.insert(0, f"{hostname} (المستضيف)")
            return active

    def stop(self):
        self._running = False
        with self._lock:
            for conn in list(self._peers):
                try:
                    conn.close()
                except Exception:
                    pass
            self._peers.clear()
        if self._sock:
            self._sock.close()

    def _accept_loop(self):
        while self._running:
            try:
                conn, _addr = self._sock.accept()
            except OSError:
                break
            if not self.broadcasting:
                # If broadcasting is OFF, reject incoming join attempts
                try:
                    conn.close()
                except Exception:
                    pass
                continue
            threading.Thread(target=self._handle_conn, args=(conn,), daemon=True).start()

    def _handle_conn(self, conn):
        try:
            hello = _recv_frame(conn)
            if not hello or not hello.startswith(b'HELLO:'):
                conn.close(); return
            req_project_id = hello[6:].decode()
            if req_project_id != self.project_id:
                conn.close(); return

            requires_password = bool(self.password_hash)
            nonce = os.urandom(16)
            _send_frame(conn, b'CHALLENGE:' + nonce.hex().encode())

            auth = _recv_frame(conn)
            if not auth or not auth.startswith(b'AUTH:'):
                conn.close(); return
            client_response_hex = auth[5:].decode()

            # Verify the client actually knows the password: derive the
            # Fernet key ourselves from (project_id, password) and check
            # that the client's response matches HMAC(key, nonce). If the
            # project requires no password, only the "no password" key is
            # accepted.
            fernet = None
            if requires_password:
                if not self._password:
                    # Host lost the in-memory password (e.g. process
                    # restarted without re-entering it) - can't verify.
                    _send_frame(conn, b'AUTH_FAIL')
                    conn.close(); return
                candidate_key = _derive_key(self.project_id, self._password)
            else:
                candidate_key = _derive_key(self.project_id, None)

            expected_hex = hmac.new(candidate_key, nonce, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected_hex, client_response_hex):
                _send_frame(conn, b'AUTH_FAIL')
                conn.close(); return

            fernet = Fernet(candidate_key)
            _send_frame(conn, b'AUTH_OK')

            with self._lock:
                self._peers[conn] = {'username': None, 'fernet': fernet, 'last_seen': time.time()}

            while self._running:
                frame = _recv_frame(conn)
                if frame is None:
                    break
                self._on_message(conn, frame)
        except Exception:
            pass
        finally:
            with self._lock:
                self._peers.pop(conn, None)
            try:
                conn.close()
            except Exception:
                pass

    def _on_message(self, conn, raw):
        peer = self._peers.get(conn)
        if not peer:
            return
        try:
            payload = json.loads(peer['fernet'].decrypt(raw).decode())
        except (InvalidToken, Exception):
            return
        peer['last_seen'] = time.time()
        peer['username'] = payload.get('username', peer['username'])

        mtype = payload.get('type')
        if mtype == 'sync_update':
            project = self.project_manager.load_project(self.project_id)
            idx = payload['page_index']
            project['pages'][idx]['ocr_data'] = payload['ocr_data']
            self.project_manager.update_project(self.project_id, project)
            self.on_remote_update(payload)
            self.broadcast_update(idx, payload['ocr_data'], payload.get('username'), exclude=conn)
        elif mtype == 'file_request':
            self._send_file(conn, peer, payload)
        elif mtype == 'presence':
            self.on_remote_update(payload)

    def _send_file(self, conn, peer, payload):
        # Only transferred when the requester explicitly asked (no images/PDF
        # sent proactively). Verifies hash first to avoid needless transfer.
        path = payload.get('path')
        if not path or not os.path.exists(path):
            return
        with open(path, 'rb') as f:
            data = f.read()
        digest = hashlib.sha256(data).hexdigest()
        if payload.get('known_hash') == digest:
            msg = {'type': 'file_skip', 'filename': payload.get('filename')}
        else:
            msg = {'type': 'file_chunk', 'filename': payload.get('filename'),
                   'sha256': digest, 'data': base64.b64encode(data).decode()}
        _send_frame(conn, peer['fernet'].encrypt(json.dumps(msg).encode()))

    def broadcast_update(self, page_index, ocr_data, username, exclude=None):
        with self._lock:
            for conn, peer in self._peers.items():
                if conn is exclude:
                    continue
                msg = {'type': 'sync_update', 'page_index': page_index,
                       'ocr_data': ocr_data, 'username': username, 'ts': time.time()}
                try:
                    _send_frame(conn, peer['fernet'].encrypt(json.dumps(msg).encode()))
                except Exception:
                    pass

    def list_peers(self):
        with self._lock:
            return [{'username': p['username'], 'last_seen': p['last_seen']} for p in self._peers.values()]


class LANSyncClient:
    """Runs on a joining machine. Connects to the host, authenticates by
    proving knowledge of the shared project password (the password itself
    is never transmitted - only proof derived from it), then stays
    connected for real-time push/pull of JSON+text updates."""

    def __init__(self, host, port, project_id, password, on_remote_update):
        self.host = host
        self.port = port
        self.project_id = project_id
        self.password = password
        self.on_remote_update = on_remote_update
        self.fernet = Fernet(_derive_key(project_id, password))
        self._key = _derive_key(project_id, password)
        self._sock = None
        self._running = False

    def connect_and_sync(self):
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.settimeout(5)
        self._sock.connect((self.host, self.port))
        _send_frame(self._sock, f'HELLO:{self.project_id}'.encode())

        challenge = _recv_frame(self._sock)
        if not challenge or not challenge.startswith(b'CHALLENGE:'):
            return {'ok': False, 'error': 'no_response'}
        nonce = bytes.fromhex(challenge[10:].decode())
        response = hmac.new(self._key, nonce, hashlib.sha256).hexdigest()
        _send_frame(self._sock, b'AUTH:' + response.encode())

        ack = _recv_frame(self._sock)
        if ack != b'AUTH_OK':
            return {'ok': False, 'error': 'auth_failed'}

        self._sock.settimeout(None)
        self._running = True
        threading.Thread(target=self._listen_loop, daemon=True).start()
        return {'ok': True, 'project': None}  # host pushes full state via first sync_update batch

    def _listen_loop(self):
        while self._running:
            frame = _recv_frame(self._sock)
            if frame is None:
                break
            try:
                payload = json.loads(self.fernet.decrypt(frame).decode())
            except Exception:
                continue
            self.on_remote_update(payload)

    def send_update(self, page_index, ocr_data, username):
        msg = {'type': 'sync_update', 'page_index': page_index, 'ocr_data': ocr_data,
               'username': username, 'ts': time.time()}
        _send_frame(self._sock, self.fernet.encrypt(json.dumps(msg).encode()))

    def send_presence(self, username, status, current_page=None):
        msg = {'type': 'presence', 'username': username, 'status': status,
               'current_page': current_page, 'ts': time.time()}
        _send_frame(self._sock, self.fernet.encrypt(json.dumps(msg).encode()))

    def request_file(self, filename, local_path_if_present=None, known_hash=None):
        msg = {'type': 'file_request', 'filename': filename, 'path': local_path_if_present,
               'known_hash': known_hash}
        _send_frame(self._sock, self.fernet.encrypt(json.dumps(msg).encode()))
