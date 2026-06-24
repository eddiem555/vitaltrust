#!/bin/sh

docker stop vitaltrust-app
docker rm vitaltrust-app

if [ ! -f /home/ubuntu/.env ] ; then
  echo "Error: Missing Vital Trust .env file!"
  echo "/home/ubuntu/.env not found" && exit 1
fi

if [ -f /tmp/vitaltrust.zip ] ; then
  sudo rm -rf /tmp/vitaltrust
  mkdir /tmp/vitaltrust
  cd /tmp && unzip /tmp/vitaltrust.zip
else
  echo "Error: Missing Vital Trust package!"
  echo "/tmp/vitaltrust.zip not found" && exit 1
fi

if [ ! -d /tmp/vitaltrust/deployment ] ; then
  echo "Error: Vital Trust Deployment directory missing!"
  echo "/tmp/vitaltrust/deployment directory not found" && exit 1
fi

rm -f /tmp/vitaltrust.zip

# Drop any stale database artifacts from prior installs (container is recreated without volumes)
rm -f /tmp/vitaltrust/persistent_db.json
rm -f /tmp/vitaltrust/deployment_config.json
rm -f /tmp/vitaltrust/system_console.log

cp /home/ubuntu/.env /tmp/vitaltrust
bash /tmp/vitaltrust/deployment/DeployVitalTrust.sh
