#!/bin/bash

# Docker initialization script for texas-dps-scheduler

# Check if HEADLESS environment variable is set to false
if [ "$HEADLESS" = "false" ]; then
    echo "Starting with xvfb for non-headless mode..."
    # Start xvfb with optimal settings for captcha avoidance
    xvfb-run -a -s '-screen 0 1920x1080x24 -ac -nolisten tcp -dpi 96' node index.js
else
    echo "Starting in headless mode..."
    node index.js
fi
