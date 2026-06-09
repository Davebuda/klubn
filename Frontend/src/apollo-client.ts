import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// HotChocolate 13 returns HTTP 500 when data is null (GraphQL-over-HTTP spec).
// Apollo treats non-2xx as a network error and won't parse graphQLErrors.
// This wrapper converts 500 responses that contain a valid GraphQL error body to 200
// so Apollo can handle them normally via the onError link.
const graphqlFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const response = await fetch(input, init);
  if (response.status === 500) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      if (json && Array.isArray(json.errors)) {
        return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    } catch {
      return new Response(text, { status: response.status, statusText: response.statusText });
    }
  }
  return response;
};

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/graphql',
  fetch: graphqlFetch,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`[GraphQL error]: Message: ${message}`, locations, path);
      // If session expired, clear localStorage and redirect to login
      if (message === 'Authentication required.') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login?expired=1';
      }
    });
  }
  if (networkError) {
    console.error('[Network error]:', networkError);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});
