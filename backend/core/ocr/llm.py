"""
LLM OCR adapter via litellm.
Same prompt template, but cleaned imports and error handling.
"""
import os
import re
import json
import base64

try:
    import litellm
except ImportError:
    litellm = None

try:
    from PIL import Image
except ImportError:
    Image = None

PROMPT_TEMPLATE = """
You are a specialized OCR and document layout extraction engine.

Your task is to extract all text and layout elements from the attached image and return ONLY a single valid JSON object.
All bounding box (bbox) coordinates MUST be normalized on a scale from 0 to 1000.
Where (0,0) is the top-left corner of the image, and (1000,1000) is the bottom-right corner.

VERY IMPORTANT: The coordinate order must strictly be [x_min, y_min, x_max, y_max]. (Never put y_min first).

Rules:
- Return the elements in the correct human reading order.
- Each element must contain:
  - bbox: [x1, y1, x2, y2] (integers from 0 to 1000)
  - category: one of ["Caption","Footnote","Formula","List-item","Page-footer","Page-header","Picture","Section-header","Table","Text","Title"]
  - text: The text content in Arabic, formatted as follows:
    - Picture: leave empty
    - Formula: use LaTeX
    - Table: use HTML
    - All others: use Markdown
- Do not translate. Extract the text exactly as it appears in the image in Arabic.
- Output ONLY the JSON code without any Markdown formatting (e.g., no ```json) and without any additional explanations.

This is the required structure:
{{
  "elements": [
    {{
      "bbox": [0, 0, 0, 0],
      "category": "Text",
      "text": "النص هنا..."
    }}
  ]
}}
"""


class LLMOCRHandler:
    def __init__(self):
        pass

    def extract_page(self, image_path: str, llm_config: dict) -> dict:
        if litellm is None:
            return {"success": False, "error": "مكتبة litellm غير متوفرة في هذه النسخة المحمولة."}
        if Image is None:
            return {"success": False, "error": "Pillow not installed, cannot read image."}

        provider = llm_config.get("provider")
        api_key = llm_config.get("apiKey")

        model_id = provider
        api_base = None

        if provider == "custom":
            model_id = f"openai/{llm_config.get('modelName')}"
            api_base = llm_config.get("baseUrl")
            os.environ["OPENAI_API_KEY"] = api_key
        elif provider.startswith("gemini"):
            os.environ["GEMINI_API_KEY"] = api_key
        elif provider.startswith("claude"):
            os.environ["ANTHROPIC_API_KEY"] = api_key
        elif provider.startswith("gpt"):
            os.environ["OPENAI_API_KEY"] = api_key
        elif provider.startswith("xai/"):
            os.environ["XAI_API_KEY"] = api_key
        elif provider.startswith("mistral/"):
            os.environ["MISTRAL_API_KEY"] = api_key
        elif provider.startswith("deepseek/"):
            os.environ["DEEPSEEK_API_KEY"] = api_key
        else:
            os.environ["OPENAI_API_KEY"] = api_key

        with Image.open(image_path) as img:
            width, height = img.size
            mime_type = f"image/{img.format.lower()}" if img.format else "image/png"
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode("utf-8")

        custom_prompt = (llm_config.get("systemPrompt") or PROMPT_TEMPLATE).strip()
        try:
            customized_prompt = custom_prompt.format(width=width, height=height)
        except Exception:
            customized_prompt = custom_prompt

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": customized_prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}},
                ],
            }
        ]

        try:
            kwargs = {"temperature": 0.0}
            if api_base:
                kwargs["api_base"] = api_base

            response = litellm.completion(model=model_id, messages=messages, **kwargs)
            output_text = response.choices[0].message.content

            clean_json_str = output_text.strip()
            if clean_json_str.startswith("```"):
                clean_json_str = re.sub(r"^```[a-zA-Z]*\n", "", clean_json_str)
                clean_json_str = re.sub(r"\n```$", "", clean_json_str)

            parsed_json = json.loads(clean_json_str)
            return {"success": True, "data": parsed_json, "img_width": width, "img_height": height}

        except json.JSONDecodeError:
            return {"success": False, "error": "النموذج لم يرجع JSON صالحاً. يرجى التأكد من قدرات النموذج المختار."}
        except Exception as e:
            return {"success": False, "error": str(e)}
