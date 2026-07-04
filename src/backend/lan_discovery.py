"""mDNS discovery of OCR-review projects shared on the LAN."""
import socket
from zeroconf import ServiceInfo, Zeroconf, ServiceBrowser

SERVICE_TYPE = "_ocrreview._tcp.local."


def _local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


class _Listener:
    def __init__(self, results):
        self.results = results

    def add_service(self, zc, type_, name):
        info = zc.get_service_info(type_, name)
        if not info:
            return
        props = {k.decode(): v.decode() for k, v in (info.properties or {}).items()}
        host = socket.inet_ntoa(info.addresses[0]) if info.addresses else None
        self.results[name] = {
            'project_id': props.get('project_id'),
            'name': props.get('name'),
            'owner': props.get('owner'),
            'requires_password': props.get('requires_password') == '1',
            'page_count': int(props.get('page_count', 0)),
            'host': host,
            'port': info.port,
        }

    def remove_service(self, zc, type_, name):
        self.results.pop(name, None)

    def update_service(self, zc, type_, name):
        self.add_service(zc, type_, name)


class LANDiscovery:
    def __init__(self):
        self._zc = None
        self._service_info = None

    def register(self, project_id, name, port, owner, requires_password, page_count):
        self._zc = self._zc or Zeroconf()
        props = {
            'project_id': project_id,
            'name': name,
            'owner': owner,
            'requires_password': '1' if requires_password else '0',
            'page_count': str(page_count),
        }
        ip = _local_ip()
        self._service_info = ServiceInfo(
            SERVICE_TYPE,
            f"{project_id}.{SERVICE_TYPE}",
            addresses=[socket.inet_aton(ip)],
            port=port,
            properties={k: v.encode() for k, v in props.items()},
        )
        self._zc.register_service(self._service_info)

    def unregister(self):
        if self._zc and self._service_info:
            self._zc.unregister_service(self._service_info)
        if self._zc:
            self._zc.close()
        self._zc = None
        self._service_info = None

    def browse(self, timeout=3):
        import time
        zc = Zeroconf()
        results = {}
        browser = ServiceBrowser(zc, SERVICE_TYPE, _Listener(results))
        time.sleep(timeout)
        browser.cancel()
        zc.close()
        return list(results.values())
