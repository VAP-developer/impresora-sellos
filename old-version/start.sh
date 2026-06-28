#!/bin/bash

# Arranca MongoDB y el demonio Python en Docker
echo "Arrancando MongoDB y demonio Python..."
docker-compose up -d

# Espera a que MongoDB esté listo
echo "Esperando a MongoDB..."
sleep 3

# Arranca Meteor apuntando al MongoDB del contenedor
echo "Arrancando Meteor..."
cd correos-webapp
MONGO_URL=mongodb://localhost:27017/correos meteor
