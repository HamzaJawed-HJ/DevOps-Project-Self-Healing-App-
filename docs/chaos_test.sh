#!/bin/bash

# URL of the API chaos endpoint
API_URL="http://localhost:3000/api/chaos?errorRate=0.5"

# URL of the Prometheus metrics endpoint
METRICS_URL="http://localhost:3000/metrics"

# Loop infinitely
while true; do
    # Trigger chaos (50% error rate)
    RESPONSE=$(curl -s $API_URL)
    echo "Chaos response: $RESPONSE"

    # Wait a little to let API register the error
    sleep 1

    # Fetch current api_errors_total from metrics
    ERRORS=$(curl -s $METRICS_URL | grep "api_errors_total" | awk '{print $2}')
    echo "Total API errors so far: $ERRORS"

    echo "-----------------------------------------"
    sleep 2
done