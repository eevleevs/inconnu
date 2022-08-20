# Intro

Inconnu, or [Nelma](https://en.wikipedia.org/wiki/Nelma) is a fish of the family Salmonidae. Despite its name meaning *unknown*, it will help you recognise the users of your web application by use of [Microsoft Authentication Library](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview) or [Okta](https://www.okta.com/).  

Inconnu runs on [Deno](https://deno.land/) and features a modular design allowing to add more identity providers.

# Running

### Locally
```deno run --allow-read --allow-env --allow-net mod.ts```

### In a container
```docker run -d -p 3001:3001 -e <provider_config> eevleevs/inconnu```

# Configuration

## Generic

| env var                | description             | default       |
| ---------------------- | ----------------------- | ------------- |
| INCONNU_JWT_EXPIRATION | token expiration time   | 1w (one week) |
| INCONNU_LOG            | enable request logging  | (not active)  |
| INCONNU_PORT           | HTTP server listen port | 3001          |

## Providers

Provider modules are activated by setting the corresponding environment variable containing the application credentials.

| env var           | format                                        |
| ----------------- | --------------------------------------------- |
| INCONNU_MICROSOFT | Azure_application_ID:Azure_application_secret |
| INCONNU_OKTA      | Okta_domain:Okta_client_ID:Okta_client_secret |

A corresponding web application must be configured on the provider and accept a `https://<inconnu_host>/<provider>/authenticated` redirect URI.

# Usage

## Authenticating a user

To authenticate redirect the client to get `/<provider>/authenticate` (e.g. `/microsoft/authenticate`), which redirects to the authentication provider where the user is identified, which redirects to `/<provider>/authenticated` where the tokens are generated, which redirects back to the requesting server. Query parameters to `/<provider>/authenticate` are:

| parameter         | provider  | format                      | description                                          |
| ----------------- | --------- | --------------------------- | ---------------------------------------------------- |
| jwtExpirationTime | all       | duration (e.g. 2h, 30d, 2w) | custom expiration time for tokens                    |
| memberOf          | microsoft | group1,group2,...           | returns input list filtered by user membership       |
| receiver          | all       | url                         | address that will receive the authentication results |

Using `memberOf` for `microsoft` provider provokes a second call to Microsoft Graph to retrieve the list of AD groups the user is member of. 
The final request to the receiver includes query parameters `username`, `jwt`, possibly `memberOf` and any other extra parameter that was provided to `/<provider>/authenticate`. 

## Verifying a previously generated token

The [JWT token](https://en.wikipedia.org/wiki/JSON_Web_Token) contains an encoded and signed version of the rest of the data, plus an expiration time. It can be stored on a client and used for successive stateless authentication. To verify a token, get `/verify?jwt=<token>` or `/<provider>/verify?jwt=<token>`. If the verification is successful, returns the decoded data. If not, returns an error message and an HTTP status code 400.

<u>Token verification should be preferred</u> if available, because it is performed much faster internally and does not require contacting the identity provider again.

Note: the `jwt`s, are based on a random secret generated at application start. Every instance of the application will generate different ones, and every instance will be able to verify only its own tokens. This means that multiple instances mounted on the same path will not work for the time being.

## Logging out

Logging out the browser from the authentication service can be obtained by getting `/<provider>/logout`, which redirects to the appropriate page. Note that this <u>does not invalidate</u> tokens stored on clients, which must be additionally deleted.