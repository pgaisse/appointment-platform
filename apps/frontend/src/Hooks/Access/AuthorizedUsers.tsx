import { Navigate, Outlet } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

type Props = {
  reqAuth: boolean;
};

function AuthorizedUsers({ reqAuth }: Props) {
  const { isLoading, isAuthenticated, getAccessTokenSilently, logout } = useAuth0();
  const [validToken, setValidToken] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      try {
        await getAccessTokenSilently(); // Intenta renovar token
        setValidToken(true);
      } catch (error) {
        console.warn("Token inválido o expirado",error);
        setValidToken(false);
        logout({
          logoutParams: {
            returnTo: window.location.origin,
          },
        });
      }
    };

    if (reqAuth) checkToken();
  }, [reqAuth, getAccessTokenSilently, logout]);

  if (isLoading) return null;
  if ((!isAuthenticated || !validToken) && reqAuth) {
    return <Navigate to="/" />;
  }

  return <Outlet />;
}

export default AuthorizedUsers;
