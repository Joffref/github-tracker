#!/bin/sh

export PATH="/usr/local/bin:$PATH"

# Start sandbox-api in the background
/usr/local/bin/sandbox-api &

wait_for_port() {
    local port=$1
    local timeout=30
    local count=0
    echo "Waiting for port $port to be available..."
    while ! nc -z 127.0.0.1 $port; do
        sleep 1
        count=$((count + 1))
        if [ $count -gt $timeout ]; then
            echo "Timeout waiting for port $port"
            exit 1
        fi
    done
    echo "Port $port is now available"
}

wait_for_port 8080

echo "Starting Next.js production server..."
curl http://localhost:8080/process -X POST -d '{"workingDir": "/app", "command": "npx next start --port 3000", "waitForCompletion": false}' -H "Content-Type: application/json"

wait
