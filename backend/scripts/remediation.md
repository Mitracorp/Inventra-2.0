Remediation commands to align Passenger nodevenv and install dependencies

Run these on the server shell (adjust paths for your app):

```bash
# use CloudLinux alt-nodejs22 in PATH
export PATH=/opt/alt/alt-nodejs22/root/usr/bin:$PATH
hash -r

# Install backend dependencies into the nodevenv lib used by Passenger
npm install --prefix /home/ivmscom/nodevenv/public_html/inventra.ivms2006.com/main/backend/22/lib --omit=dev --no-audit --no-fund

# Symlink node_modules so the app root used by Passenger can load them
cd /home/ivmscom/public_html/inventra.ivms2006.com/main/backend
rm -rf node_modules
ln -s /home/ivmscom/nodevenv/public_html/inventra.ivms2006.com/main/backend/22/lib/node_modules node_modules
chown -h ivmscom:ivmscom node_modules || true
chown -R ivmscom:ivmscom /home/ivmscom/nodevenv/public_html/inventra.ivms2006.com/main/backend/22/lib/node_modules || true

# Restart Passenger by touching restart file
mkdir -p tmp
touch tmp/restart.txt

# Tail passenger log to verify errors
tail -n 200 /home/ivmscom/logs/passenger.log

# Test API health
curl -i https://inventra.ivms2006.com/api/health
```

Notes:
- Use exact nodevenv path from your cPanel Node.js app settings if different.
- If modules still appear missing, run `node -e "console.log(require.resolve('cors'))"` from the app root to see resolution path.
