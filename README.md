# Intro

Inconnu, or [Nelma](https://en.wikipedia.org/wiki/Nelma) is a fish of the family Salmonidae. Despite its name meaning *unknown*, it will help you recognise the users of your application by use of [Microsoft Authentication Library](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview) or [Okta](https://www.okta.com/). It acts as an intermediary towards different identity providers, simplifying and standardising their interface. It is particularly useful in a setup where an organisation maintains several applications that use external authentication but not authorisation, so that a single identity provider configuration can be shared.

Inconnu runs on [Deno](https://deno.land/) and features a modular design allowing to add further identity providers.


# Running

### Locally
```deno run --allow-read --allow-env --allow-net mod.ts```

### In a container
```docker run -d -p 3001:3001 -e <config> eevleevs/inconnu```


# Configuration

## Hub mode

In this mode, Inconnu acts as an intermediary towards the identity providers, allowing multiple applications to use a single configuration with a standard interface.

Provider modules are activated by setting the corresponding environment variable containing the application credentials.

| env var           | format                                        |
| ----------------- | --------------------------------------------- |
| INCONNU_MICROSOFT | Azure_application_ID:Azure_application_secret |
| INCONNU_OKTA      | Okta_domain:Okta_client_ID:Okta_client_secret |

A corresponding web application must be configured on the provider and accept a `http(s)://<inconnu_host>/<provider>/authenticated` redirect URI.

### Routes

#### `/<provider>/authenticate`
Initiates the authentication flow by redirecting to the authentication provider, which will shall in turn be configured to redirect to `/<provider>/authenticated`. Any practical use of Inconnu should provide the `receiver` query parameter here to specify where to redirect the next call. Other query parameters are forwarded.  
Microsoft provider accepts also a list of comma-separated AD groups as a `memberOf` query parameters. If provided, the hub makes a second call to Microsoft Graph and returns the list filtered by actual membership.  

#### `/<provider>/authenticated`
Receives and stores authentication data from identity provider that can be later exchanged for user id data (payload). Redirects to the `receiver` url provided to `/authenticate` with a single-use reference code to the authentication data.

#### `/<provider>/logout`
Redirects to the identity provider logout page.

#### `/<provider>/redeem`
Retrieves and returns the payload referenced by the `code` query parameter provided by `/authenticate`, with additional output as [JWT](#jwt), if the `jwt` query parameter is set to any value.

#### `/<provider>/verify`
See [`/verify`](#verify).


## Satellite mode

In this mode, Inconnu acts as an intermediary between a web application on the same host and an Inconnu hub on another host. A "sat" is mounted on a subdirectory of the application host and further simplifies the flow by setting an authentication cookie readable by the application. 

Sat mode is activated by setting the `INCONNU_HUB_URL` environment variable to the URL of hub+provider, e.g. `https://<hub_url>/<provider>`. Any hub configuration variable is then ignored.

Satellite `<path>` defaults to `/inconnu`, and can be customised with the `INCONNU_SAT_PATH` environment variable.

### Routes

#### `<path>/authenticate`
Redirects to the hub `/authenticate` route. Accepts a `redirect` query parameter with the url to navigate to after the authentication workflow is complete. Other query parameters are forwarded.


#### `<path>/authenticated`
Receives a reference code from the hub, redeems it for the authentication data, signs a [JWT](#jwt) and sets it in the `inconnu-auth` cookie accessible from the host.

#### `<path>/logout`
Clears the `inconnu-auth` cookie and redirects to the hub logout page.

#### `/<path>/verify`
See [`/verify`](#verify).


## Generic

### Environment variables (usable in both modes)

| env var                | description             | default                 |
| ---------------------- | ----------------------- | ----------------------- |
| INCONNU_JWT_EXPIRATION | token expiration time   | 1w (one week)           |
| INCONNU_LOG            | enable request logging  | (undefined, not active) |
| INCONNU_PORT           | HTTP server listen port | 3001                    |

### Routes

#### `/`

Redirects to this README page.

#### `/verify` <a name="verify"></a>

Verifies a JWT sent either with Bearer authentication, or in the `inconnu-auth` cookie.

<a name="jwt"></a>[JWT](https://en.wikipedia.org/wiki/JSON_Web_Token) is a standard for information signing. It is used by Inconnu to sign information received from identity providers with a randomly generated secret key. The same Inconnu instance can verify the authenticity and temporal validity of the information without contacting the provider again and without storing anything.


# Usage examples

## Express middleware

In the following example:

- Inconnu satellite is mounted on `authService`;
- if the `inconnu-auth` cookie is provided and a call to `/verify` is successful, the id details are added to `req.user`, otherwise the call is redirected to `/authenticate`;
- during development, Inconnu sat might not be deployed on the same host (and then not be able to set cookies); in this case, a token can be provided through `authCookie`.

```js
app.use(async (req, res, next) => {
    const cookie = authCookie ? `inconnu-auth=${authCookie}` : req.get('cookie')
    if (cookie) {
        const result = await fetch(authService + '/verify', {headers: {cookie}})
        if (result.status == 200) {
            req.user = await result.json()
            return next()
        }
    }
    res.redirect(authService + '/authenticate?' + encode({
        // memberOf: groups,  // optional check of group membership (only MS)
        redirect: req.url,
    }))
})
