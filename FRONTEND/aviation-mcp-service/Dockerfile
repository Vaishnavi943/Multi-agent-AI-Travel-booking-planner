FROM python:3.13-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Clone and install aviationstack-mcp
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/pradumnasaraf/aviationstack-mcp.git .
RUN uv pip install --system -e .

# Copy our HTTP wrapper
COPY server.py .

ENV PORT=8080
EXPOSE 8080

CMD ["python", "server.py"]