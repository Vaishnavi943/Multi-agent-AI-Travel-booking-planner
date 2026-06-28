FROM python:3.13-slim

WORKDIR /app

RUN pip install uv

COPY requirements.txt .
RUN uv pip install --system -r requirements.txt

COPY server.py .

ENV PORT=8080
EXPOSE 8080

CMD ["python", "server.py"]