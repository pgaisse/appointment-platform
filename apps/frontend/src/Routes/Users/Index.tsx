import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import {
  Box,
  Center,
  Heading,
  Spinner,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";

interface User {
  id: string;
  name: string;
  email: string;
}

const Users = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const token = await getAccessTokenSilently();
        const res = await fetch(`${import.meta.env.VITE_APP_SERVER}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {
        console.error("Failed to load users", err);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [getAccessTokenSilently]);

  if (loading) {
    return (
      <Center py={10}>
        <Spinner />
      </Center>
    );
  }

  return (
    <Box p={6}>
      <Heading size="md" mb={4}>
        User Management
      </Heading>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>ID</Th>
            <Th>Name</Th>
            <Th>Email</Th>
          </Tr>
        </Thead>
       <Tbody>
          {users.length === 0 ? (
            <Tr>
              <Td colSpan={3}>No users found</Td>
            </Tr>
          ) : (
            users.map((user) => (
              <Tr key={user.id}>
                <Td>{user.id}</Td>
                <Td>{user.name}</Td>
                <Td>{user.email}</Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </Box>
  );
};

export default Users;
