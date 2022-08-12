# Intro

Inconnu, or [Nelma](https://en.wikipedia.org/wiki/Nelma) is a fish of the family Salmonidae. Despite its name meaning *unknown*, it will help you recognise the users of your web application by use of [Microsoft Authentication Library](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview).

Inconnu runs on [Deno](https://deno.land/) and connects to Microsoft Azure for authentication. A corresponding Azure application must be configured through [App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) as web application and accept an `/authenticated` redirect URI. Azure application ID and secret must be provided through environment variables or `.env` file. 

# Running

### Locally
```deno run --allow-read --allow-env --allow-net mod.ts```

### In a container
```docker run -d -p 3001:3001 -e clientId=<id> -e clientSecret=<secret> eevleevs/inconnu```

# Configuration

| env var           | required | description             | default       |
| ----------------- | -------- | ----------------------- | ------------- |
| clientId          | yes      | Azure app id            |               |
| clientSecret      | yes      | Azure app secret        |               |
| jwtExpirationTime | no       | token expiration time   | 1w (one week) |
| listenPort        | no       | HTTP server listen port | 3001          |
| logging           | no       | enable request logging  |               |

# Usage

## Authenticating a user

To authenticate redirect the client to get `/authenticate`, which redirects to Microsoft where the user is identified, which redirects to `/authenticated` where the tokens are generated, which redirects back to the requesting server. Query parameters to `/authenticate` are:

| parameter | required | format                            | description                                                |
| --------- | -------- | --------------------------------- | ---------------------------------------------------------- |
| receiver  | yes      | url                               | final address that will receive the authentication results |
| memberOf  | no       | comma separated list of AD groups | returns input list filtered by user membership             |

Using `memberOf` provokes a second call to Microsoft Graph to retrieve the list of AD groups the user is member of.  
The final request to the receiver includes query parameters `username`, `jwt`, possibly `memberOf` and any other extra parameter that was provided to `/authenticate`. 

## Verifying a previous token

The [JWT token](https://en.wikipedia.org/wiki/JSON_Web_Token) contains an encoded and signed version of the rest of the data, plus an expiration time. It can be stored on a client and used for successive stateless authentication. To verify a token, get `/verify/:jwt`, where `:jwt` is the token. If the verification is successful, returns the decoded data. If not, returns an error message and an HTTP status code 400.

<u>Token verification should be preferred</u> when available, because it is performed much faster internally without any further call to Microsoft.

Note: the `jwt`s, are based on a random secret generated at application start. Every instance of the application will generate different ones, and every instance will be able to verify only its own tokens. This means that multiple instances mounted on the same path will not work for the time being.

## Logging out

Logging out the browser from Microsoft can be obtained by getting `/logout`, which redirects to the appropriate page. Note that this <u>does not invalidate</u> tokens stored on clients, which must be additionally deleted.
