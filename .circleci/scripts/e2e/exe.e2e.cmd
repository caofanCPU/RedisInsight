@echo off

set COMMON_URL=%USERPROFILE%/AppData/Local/Programs/redisinsight/resources/app.asar/index.html
set ELECTRON_PATH=%USERPROFILE%/AppData/Local/Programs/redisinsight/RedisInsight-v2.exe

call yarn --cwd tests/e2e install

call "./release/RedisInsight-v2-win-installer.exe"

:: waiting until app auto launches
timeout 5

:: close an auto launched app
taskkill /im RedisInsight-v2.exe /f
taskkill /im RedisInsight-v2-win-installer.exe /f

set OSS_STANDALONE_HOST=%E2E_CLOUD_DATABASE_HOST%
set OSS_STANDALONE_PORT=%E2E_CLOUD_DATABASE_PORT%
:: set OSS_STANDALONE_USERNAME=""
set OSS_STANDALONE_PASSWORD=%E2E_CLOUD_DATABASE_PASSWORD%

call yarn --cwd tests/e2e dotenv -e .desktop.env yarn --cwd tests/e2e test:desktop:ci:win