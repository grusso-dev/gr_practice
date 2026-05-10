# Paso 11: Deploy en VPS (Hostinger) con Socket.IO

## 1) Objetivo del paso

Llevar tu proyecto a un servidor real (VPS) con buenas practicas:

- Exponer solo `80/443`.
- Ejecutar `server.js` y `server_ext.js` como servicios.
- Configurar Nginx como reverse proxy para HTTP + WebSocket.
- Habilitar SSL con Let's Encrypt.

## 2) Que cambia respecto al paso anterior

En el Paso 10 todo se ejecutaba local en `localhost`.

Ahora pasamos a infraestructura real:

- Procesos Node permanentes con `systemd`.
- Puertos internos privados (`3000`, `4100`).
- Nginx publica todo por dominio en `443`.
- Firewall estricto en VPS.

## 3) Bloques de codigo que cambian vs Paso 10

### Bloque 1 (firewall) - abrir solo puertos publicos

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Bloque 2 (Nginx) - proxy para Socket.IO y `/publish`

```nginx
location /socket.io/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}

location /publish {
  proxy_pass http://127.0.0.1:4100/publish;
}
```

### Bloque 3 (systemd) - procesos siempre activos

```ini
[Service]
WorkingDirectory=/var/www/socketio
ExecStart=/usr/bin/node /var/www/socketio/server.js
Restart=always
```

## 4) Codigo completo - unidad `systemd` para `server.js`

Archivo: `/etc/systemd/system/socketio-main.service`

```ini
[Unit]
Description=Socket.IO Main Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/socketio
ExecStart=/usr/bin/node /var/www/socketio/server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 5) Codigo completo - unidad `systemd` para `server_ext.js`

Archivo: `/etc/systemd/system/socketio-ext.service`

```ini
[Unit]
Description=Socket.IO External Bridge Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/socketio
ExecStart=/usr/bin/node /var/www/socketio/server_ext.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 6) Codigo completo - config Nginx (HTTP + WebSocket)

Archivo: `/etc/nginx/sites-available/socketio`

```nginx
server {
    listen 80;
    server_name midominio.com.ar www.midominio.com.ar;

    # Ruta principal -> server.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO (upgrade WebSocket)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Publicacion externa -> server_ext.js
    location = /publish {
        proxy_pass http://127.0.0.1:4100/publish;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 7) Comandos de despliegue recomendados

### 7.1 Instalar base del servidor

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 7.2 Subir proyecto e instalar deps

```bash
sudo mkdir -p /var/www/socketio
sudo chown -R $USER:$USER /var/www/socketio
# Copia tu proyecto a /var/www/socketio
cd /var/www/socketio
npm install
```

### 7.3 Activar servicios systemd

```bash
sudo systemctl daemon-reload
sudo systemctl enable socketio-main
sudo systemctl enable socketio-ext
sudo systemctl start socketio-main
sudo systemctl start socketio-ext
```

### 7.4 Activar Nginx site

```bash
sudo ln -s /etc/nginx/sites-available/socketio /etc/nginx/sites-enabled/socketio
sudo nginx -t
sudo systemctl reload nginx
```

### 7.5 SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d midominio.com.ar -d www.midominio.com.ar
```

## 8) Verificaciones clave

1. `systemctl status socketio-main` -> activo.
2. `systemctl status socketio-ext` -> activo.
3. `https://midominio.com.ar` carga el chat.
4. Navegador conecta Socket.IO sin errores de upgrade.
5. `POST https://midominio.com.ar/publish` con API key publica mensaje.

## 9) Seguridad minima recomendada

- No expongas `3000` ni `4100` a internet.
- Usa API keys por variables de entorno, no hardcodeadas.
- Restringe origenes CORS solo a dominios necesarios.
- Rota llaves periodicamente.
- Habilita logs y monitoreo basico (journalctl + fail2ban opcional).

## 10) Errores comunes en Hostinger VPS

- WebSocket falla: falta bloque `/socket.io/` con headers `Upgrade`.
- 502 Bad Gateway: proceso Node caido o puerto mal en `proxy_pass`.
- SSL ok pero sin conexion Socket.IO: mezcla de `http` y `https` en cliente.
- `/publish` devuelve 401: API key no coincide.

## 11) Resultado de este paso

Tu app queda desplegada de forma robusta en VPS:

- Chat principal por `https://midominio.com.ar`.
- Publicacion externa por `https://midominio.com.ar/publish`.
- Procesos persistentes y reinicio automatico.
