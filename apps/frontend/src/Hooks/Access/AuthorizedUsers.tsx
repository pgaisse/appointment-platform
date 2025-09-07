import { Navigate, Outlet } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

type Props = {
  reqAuth: boolean;
  roles?: string[];
};

function AuthorizedUsers({ reqAuth, roles }: Props) {
  const { isLoading, isAuthenticated, getAccessTokenSilently, logout, user } = useAuth0();
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

  const userRoles: string[] = (user && (user as any)["https://letsmarter.com/roles"]) || (user as any)?.roles || [];

  if (isLoading) return null;
  if ((!isAuthenticated || !validToken) && reqAuth) {
    return <Navigate to="/" />;
  }
  if (reqAuth && roles && !roles.some((r) => userRoles.includes(r))) {
    return <Navigate to="/" />;
  }

  return <Outlet />;
}

export default AuthorizedUsers;
