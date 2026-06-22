# Update the package index
apt-get update

# Install prerequisites
apt-get install -y ca-certificates curl gnupg

# Add Docker’s official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine, CLI, Containerd, and the Docker Compose Plugin
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installations
docker --version
docker compose version

# Create the docker group (if it doesn't already exist)
sudo groupadd docker

# Add the 'ubuntu' user to the docker group
sudo usermod -aG docker $USER

# Apply the group changes immediately to your current session
# (This saves you from having to log out and back in)
newgrp docker