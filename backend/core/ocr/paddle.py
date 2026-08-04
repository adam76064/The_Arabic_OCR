"""
PaddleOCR client - refactored adapter.
Original logic preserved from paddleocr_client.py but cleaned.
"""
import os
import time
import json
import random
import string
import hmac
import hashlib
import urllib.parse
from datetime import date
import requests


class PaddleOCRClient:
    def __init__(self, data_dir="data"):
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        self.limits_file = os.path.join(self.data_dir, "paddle_limits.json")
        self.max_pages_per_chunk = 200

    def get_limits(self):
        today_str = date.today().isoformat()
        if os.path.exists(self.limits_file):
            try:
                with open(self.limits_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("date") == today_str:
                        return data.get("trials_left", 3)
            except Exception:
                pass
        return 3

    def decrement_limit(self):
        trials_left = self.get_limits()
        if trials_left > 0:
            trials_left -= 1
        with open(self.limits_file, "w", encoding="utf-8") as f:
            json.dump({"date": date.today().isoformat(), "trials_left": trials_left}, f)
        return trials_left

    def _create_session(self):
        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "*/*",
                "Referer": "https://aistudio.baidu.com/paddleocr",
                "Origin": "https://aistudio.baidu.com",
                "X-Requested-With": "XMLHttpRequest",
            }
        )
        try:
            session.get("https://aistudio.baidu.com/paddleocr", timeout=10)
        except Exception:
            pass
        return session

    def _generate_bce_headers(self, ak, sk, token, bucket, object_key, method="PUT", query_params=None):
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        timestamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        host = f"{bucket}.bj.bcebos.com"

        headers = {"Host": host, "x-bce-date": timestamp, "x-bce-security-token": token}
        canonical_uri = urllib.parse.quote(object_key if object_key.startswith("/") else "/" + object_key, safe="/~")

        canonical_query_string = ""
        if query_params:
            query_parts = [
                f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(str(v), safe='')}" if v != "" else f"{urllib.parse.quote(k, safe='')}="
                for k, v in sorted(query_params.items())
            ]
            canonical_query_string = "&".join(query_parts)

        canonical_headers = f"host:{urllib.parse.quote(host, safe='')}\nx-bce-date:{urllib.parse.quote(timestamp, safe='')}\nx-bce-security-token:{urllib.parse.quote(token, safe='')}"
        signed_headers = "host;x-bce-date;x-bce-security-token"
        canonical_request = f"{method}\n{canonical_uri}\n{canonical_query_string}\n{canonical_headers}"

        auth_string_prefix = f"bce-auth-v1/{ak}/{timestamp}/1800"
        signing_key = hmac.new(sk.encode("utf-8"), auth_string_prefix.encode("utf-8"), hashlib.sha256).hexdigest()
        signature = hmac.new(signing_key.encode("utf-8"), canonical_request.encode("utf-8"), hashlib.sha256).hexdigest()

        headers["Authorization"] = f"{auth_string_prefix}/{signed_headers}/{signature}"
        return headers

    def process_pdf_chunk(self, file_path, window=None):
        session = self._create_session()
        safe_api_filename = "doc_" + "".join(random.choices(string.ascii_letters + string.digits, k=6)) + ".pdf"

        bosacl_url = f"https://aistudio.baidu.com/paddlex/v3/ocr/upload/bosacl?source=paddleOcr&fileOriginName={safe_api_filename}"
        res = session.get(bosacl_url)
        acl_data = res.json().get("result", {})
        if not acl_data:
            raise Exception("Failed to get BOS credentials")

        ak, sk, token = acl_data["accessKeyId"], acl_data["secretAccessKey"], acl_data["sessionToken"]
        bucket, object_key = acl_data["bucketName"], acl_data["fileKey"]

        base_url = f"https://{bucket}.bj.bcebos.com{object_key}"
        init_headers = self._generate_bce_headers(ak, sk, token, bucket, object_key, method="POST", query_params={"uploads": ""})
        init_res = requests.post(f"{base_url}?uploads=", headers=init_headers)
        upload_id = init_res.json().get("uploadId")

        part_headers = self._generate_bce_headers(
            ak, sk, token, bucket, object_key, method="PUT", query_params={"partNumber": "1", "uploadId": upload_id}
        )
        with open(file_path, "rb") as f:
            part_res = requests.put(f"{base_url}?partNumber=1&uploadId={upload_id}", data=f.read(), headers=part_headers)

        etag = part_res.headers.get("ETag", "").replace('"', "")
        comp_headers = self._generate_bce_headers(ak, sk, token, bucket, object_key, method="POST", query_params={"uploadId": upload_id})
        requests.post(f"{base_url}?uploadId={upload_id}", json={"parts": [{"partNumber": 1, "eTag": etag}]}, headers=comp_headers)

        task_res = session.post(
            "https://aistudio.baidu.com/paddlex/v3/ocr/tasks", json={"fileNames": [safe_api_filename], "parseModel": "PaddleOCR-VL-1.6"}
        )
        task_data = task_res.json().get("result", [])
        task_id = task_data[0].get("taskId") if isinstance(task_data, list) else task_data.get("taskId")

        session.get(
            "https://aistudio.baidu.com/paddlex/v3/ocr/tasks/addfile",
            params={"source": "paddleOcr", "fileOriginName": safe_api_filename, "taskId": task_id, "bucketName": bucket, "fileKey": object_key},
        )

        poll_data = None
        while True:
            poll_res = session.post("https://aistudio.baidu.com/paddlex/v3/ocr/tasks/batch", json={"taskIds": [task_id]})
            result_list = poll_res.json().get("result", [])
            if not result_list:
                time.sleep(3)
                continue

            task_info = result_list[0]
            status = task_info.get("taskStatus")

            if window:
                total_pages = task_info.get("totalPages", 1)
                extracted = task_info.get("extractedPages", 0)
                msg = f"معالجة... {extracted}/{total_pages}"
                try:
                    window.evaluate_js(f"if (window.onPaddleProgress) window.onPaddleProgress('{msg}', {(extracted/total_pages)*100});")
                except Exception:
                    pass

            if status == 5:
                detail_res = session.get(f"https://aistudio.baidu.com/paddlex/v3/ocr/tasks/{task_id}/detail?taskId={task_id}")
                poll_data = detail_res.json()
                break
            elif status in [-1, 6]:
                raise Exception(f"Task Failed with status {status}")
            time.sleep(4)

        raw_parsing_result = poll_data.get("result", {}).get("parsingResult", "{}")
        return json.loads(raw_parsing_result).get("layoutParsingResults", [])

    def parse_paddle_to_app_format(self, paddle_pages, project_pages, start_idx):
        app_pages = []
        for i, page_data in enumerate(paddle_pages):
            actual_page_index = start_idx + i
            if actual_page_index >= len(project_pages):
                break

            target_page = project_pages[actual_page_index]
            target_w = (target_page.get("native_width", 0) / 72.0) * 200.0
            target_h = (target_page.get("native_height", 0) / 72.0) * 200.0

            pruned = page_data.get("prunedResult", {})
            json_w = pruned.get("width", 1)
            json_h = pruned.get("height", 1)

            scale_x = target_w / json_w if json_w > 0 else 1.0
            scale_y = target_h / json_h if json_h > 0 else 1.0

            items = pruned.get("parsing_res_list", [])
            blocks = []
            for item in items:
                bbox = item.get("block_bbox") or item.get("bbox") or item.get("coordinate")
                if not (isinstance(bbox, (list, tuple)) and len(bbox) == 4):
                    continue

                scaled_bbox = [
                    round(bbox[0] * scale_x, 2),
                    round(bbox[1] * scale_y, 2),
                    round(bbox[2] * scale_x, 2),
                    round(bbox[3] * scale_y, 2),
                ]

                label = str(item.get("block_label", "Text")).capitalize()
                category = "Text"
                if "table" in label.lower():
                    category = "Table"
                elif "image" in label.lower() or "figure" in label.lower():
                    category = "Picture"
                elif "title" in label.lower() or "header" in label.lower():
                    category = "Title"

                blocks.append(
                    {"bbox": scaled_bbox, "text": item.get("block_content", ""), "category": category, "reviewed": False, "dir": "rtl", "align": "right"}
                )
            app_pages.append(blocks)
        return app_pages
