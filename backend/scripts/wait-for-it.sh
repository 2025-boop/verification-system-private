#!/bin/bash
# wait-for-it.sh: Wait for a service to be ready
# Usage: ./wait-for-it.sh host:port [-t timeout] [-s silent] [-- command ...]
#
# This script will wait for a service to be reachable before executing a command

set -e

waitForIt() {
    local serviceAddress=$1
    local timeout=${TIMEOUT:-15}
    local strict=${STRICT:-0}
    shift 1
    local cmd=("$@")
    local waitAfterCmd=${WAIT_AFTER_CMD:-0}

    # Parse host and port
    local host="${serviceAddress%:*}"
    local port="${serviceAddress#*:}"

    if [ -z "$port" ] || [ "$port" = "$host" ]; then
        port=80
    fi

    echo "Waiting for service at $host:$port for up to $timeout seconds..."

    local start_ts=$(date +%s)
    while :
    do
        local now_ts=$(date +%s)
        if [ $((now_ts - start_ts)) -gt $timeout ]; then
            echo "Timeout: Service at $host:$port did not respond within $timeout seconds"
            if [ $strict -ne 0 ]; then
                exit 1
            fi
            break
        fi

        # Try to connect
        if (echo > /dev/tcp/$host/$port) 2>/dev/null; then
            echo "✅ Service at $host:$port is ready!"
            if [ -n "$waitAfterCmd" ] && [ $waitAfterCmd -gt 0 ]; then
                echo "Waiting an additional $waitAfterCmd seconds after service is ready..."
                sleep $waitAfterCmd
            fi
            break
        fi

        echo "Service not ready, retrying..."
        sleep 1
    done

    # Execute command if provided
    if [ ${#cmd[@]} -gt 0 ]; then
        echo "Executing command: ${cmd[*]}"
        exec "${cmd[@]}"
    fi
}

waitForIt "$@"
