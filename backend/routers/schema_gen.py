from fastapi import APIRouter
from models.schemas import SchemaRequest
from services.schema_generator import generate_local_business_schema, generate_script_tag

router = APIRouter()


@router.post("/generate")
async def generate_schema(req: SchemaRequest):
    """LocalBusiness JSON-LD 자동 생성 (1클릭, 네이버 크롤링 차단 대응)"""
    schema = generate_local_business_schema(req)
    script = generate_script_tag(schema)
    return {
        "schema": schema,
        "script_tag": script,
        "instructions": "아래 <script> 태그를 웹사이트 <head> 또는 <body> 하단에 붙여넣으세요.",
    }
