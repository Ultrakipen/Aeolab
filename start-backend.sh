#!/bin/bash
cd /c/app_build/aeolab
source backend_venv/Scripts/activate
cd backend
uvicorn main:app --reload --port 8000
