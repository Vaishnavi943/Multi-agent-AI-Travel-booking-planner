FROM python:3.13-slim

WORKDIR /app

RUN pip install uv
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Clone aviationstack-mcp
RUN git clone https://github.com/pradumnasaraf/aviationstack-mcp.git .

# Install package + uvicorn explicitly
RUN uv pip install --system -e . && uv pip install --system uvicorn

# Copy our server wrapper
COPY server.py .

ENV PORT=8080
EXPOSE 8080

CMD ["python", "server.py"]