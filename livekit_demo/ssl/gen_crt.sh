#### 生成私钥
###openssl genpkey -algorithm RSA -out private.key -pkeyopt rsa_keygen_bits:2048
###
#### 创建CSR文件，包含多个域名
###openssl req -new -key private.key -out cert_req.csr -subj "/CN=google.com" -addext "subjectAltName=DNS:meeting.tpo.google.com,DNS:meeting-outer.tpo.google.com"
###
#### 转换crt
###openssl x509 -req -days 3650 -in cert_req.csr -signkey private.key -out meeting.tpo.google.com.crt
###
###
####
###openssl req -new -SHA256 -newkey rsa:2048 -nodes -keyout meeting.tpo.google.com.key -out meeting.tpo.google.com.csr -subj "/C=CN/ST=SC/L=CD/O=GOOGLE/OU=TPO/CN=meeting.tpo.google.com" -addext "subjectAltName=DNS:meeting.tpo.google.com,DNS:meeting-outer.tpo.google.com"
###openssl x509 -req -days 3650 -in meeting.tpo.google.com.csr -signkey meeting.tpo.google.com.key -out meeting.tpo.google.com.crt
###
###

# CA
openssl req -new -SHA256 -newkey rsa:2048 -nodes -keyout ca.key -out ca.csr -subj "/C=CN/ST=SC/L=CD/O=GOOGLE/OU=TPO/CN=TPO"
openssl x509 -req -days 3650 -sha1 -extensions v3_ca -signkey ca.key -in ca.csr -out ca.cer 

# 证书
cat ssl.conf
openssl genrsa -out meeting.key 2048
openssl req -new -key meeting.key -config ssl.conf -out meeting.csr -subj "/C=CD/ST=SC/L=China/OU=GOOGLE/CN=meeting.tpo.google.com"
openssl x509 -req -days 3650 -in meeting.csr -CA ca.cer -CAcreateserial -CAkey ca.key -out meeting.crt -extensions v3_req  -extfile ssl.conf
