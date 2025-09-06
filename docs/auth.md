# Autenticación con Auth0

Este proyecto utiliza [Auth0](https://auth0.com) para gestionar la autenticación y autorización.

## Obtención del token

1. Registra una aplicación en el panel de Auth0 y obtén el `domain`, `client_id` y `audience`.
2. Realiza una petición `POST` al endpoint `https://<domain>/oauth/token` con las credenciales del cliente y el flujo correspondiente (por ejemplo, *Authorization Code* con PKCE o *Client Credentials*).
3. Auth0 devolverá un **access token** JWT que será utilizado por los servicios del proyecto.

Ejemplo básico usando `curl`:

```bash
curl --request POST \
  --url https://<domain>/oauth/token \
  --header 'content-type: application/json' \
  --data '{"client_id":"<client_id>","client_secret":"<client_secret>","audience":"<audience>","grant_type":"client_credentials"}'
```

## Claims utilizados

El token emitido por Auth0 incluye varios *claims*. Este proyecto usa especialmente:

- `role`: define el rol del usuario dentro de la plataforma.
- `organization`: identifica la organización a la que pertenece el usuario.

Estos claims se emplean en el backend para tomar decisiones de autorización.

## Extender los claims

Para añadir claims adicionales es necesario crear una [Rule o Action](https://auth0.com/docs/customize/actions) en Auth0 que modifique el token antes de ser emitido. Los claims personalizados deben estar **namespaced**, por ejemplo:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  api.idToken.setCustomClaim('https://example.com/department', event.user.app_metadata.department);
};
```

Una vez agregados, los servicios del proyecto podrán leerlos del token y aplicar la lógica correspondiente.
