# Intro

Inconnu, or [Nelma](https://en.wikipedia.org/wiki/Nelma) is a fish of the family Salmonidae. Despite its name meaning *unknown*, it will help you recognise the users of your web application by use of [Microsoft Authentication Library](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview).  
Inconnu runs on [Deno](https://deno.land/) and features a modular design that will allow to add more identity providers.

# Running

### Locally
```deno run --allow-read --allow-env --allow-net mod.ts```

### In a container
```docker run -d -p 3001:3001 -e <provider_config> eevleevs/inconnu```

# Configuration

## Generic

| env var                     | description             | default       |
| --------------------------- | ----------------------- | ------------- |
| INCONNU_JWT_EXPIRATION_TIME | token expiration time   | 1w (one week) |
| INCONNU_LISTEN_PORT         | HTTP server listen port | 3001          |
| INCONNU_LOGGING             | enable request logging  | (not active)  |

## Providers

Providers are activated by setting the corresponding environment variable containing application credentials.

### Microsoft


| env var           | description                   |
| ----------------- | ----------------------------- |
| INCONNU_MICROSOFT | Azure_app_id:Azure_app_secret |

A corresponding Azure application must be configured through [App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) as web application and accept a `https://<host>/microsoft/authenticated` redirect URI.

# Usage

## Authenticating a user

To authenticate redirect the client to get `/<provider>/authenticate` (e.g. `/microsoft/authenticate`), which redirects to the authentication provider where the user is identified, which redirects to `/<provider>/authenticated` where the tokens are generated, which redirects back to the requesting server. Query parameters to `/<provider>/authenticate` are:

| parameter         | provider  | required | format                      | description                                                |
| ----------------- | --------- | -------- | --------------------------- | ---------------------------------------------------------- |
| jwtExpirationTime | all       | no       | duration (e.g. 2h, 30d, 2w) | custom expiration time for tokens                          |
| receiver          | all       | yes      | url                         | final address that will receive the authentication results |
| memberOf          | microsoft | no       | group1,group2,...           | returns input list filtered by user membership             |

Using `memberOf` for `microsoft` provider provokes a second call to Microsoft Graph to retrieve the list of AD groups the user is member of. 
The final request to the receiver includes query parameters `username`, `jwt`, possibly `memberOf` and any other extra parameter that was provided to `/<provider>/authenticate`. 

## Verifying a previously generated token

The [JWT token](https://en.wikipedia.org/wiki/JSON_Web_Token) contains an encoded and signed version of the rest of the data, plus an expiration time. It can be stored on a client and used for successive stateless authentication. To verify a token, get `/verify/:jwt`, where `:jwt` is the token. If the verification is successful, returns the decoded data. If not, returns an error message and an HTTP status code 400.

<u>Token verification should be preferred</u> if available, because it is performed much faster internally and does not require contacting the identity provider again.

Note: the `jwt`s, are based on a random secret generated at application start. Every instance of the application will generate different ones, and every instance will be able to verify only its own tokens. This means that multiple instances mounted on the same path will not work for the time being.

## Logging out

Logging out the browser from the authentication service can be obtained by getting `/<provider>/logout`, which redirects to the appropriate page. Note that this <u>does not invalidate</u> tokens stored on clients, which must be additionally deleted.
