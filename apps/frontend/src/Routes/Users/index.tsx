import { useEffect, useState } from 'react';
import { useApi } from '@/api/client';
import { Table, Thead, Tbody, Tr, Th, Td, Button, Input } from '@chakra-ui/react';

interface Profile {
  id: string;
  fullName?: string;
  phone?: string;
  address?: string;
}

interface User {
  id: string;
  email?: string;
  name?: string;
  profile?: Profile;
}

export default function Users() {
  const api = useApi();
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await api.get('/api/users');
    setUsers(data);
  }

  function startEdit(u: User) {
    setEditing(u.id);
    setForm({
      email: u.email || '',
      name: u.name || '',
      fullName: u.profile?.fullName || '',
      phone: u.profile?.phone || '',
      address: u.profile?.address || '',
    });
  }

  async function save() {
    await api.put(`/api/users/${editing}`, {
      email: form.email || null,
      name: form.name || null,
      profile: {
        fullName: form.fullName || null,
        phone: form.phone || null,
        address: form.address || null,
      },
    });
    setEditing(null);
    await load();
  }

  return (
    <Table variant="simple">
      <Thead>
        <Tr>
          <Th>Email</Th>
          <Th>Name</Th>
          <Th>Full Name</Th>
          <Th>Phone</Th>
          <Th>Address</Th>
          <Th></Th>
        </Tr>
      </Thead>
      <Tbody>
        {users.map((u) => (
          <Tr key={u.id}>
            <Td>
              {editing === u.id ? (
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              ) : (
                u.email
              )}
            </Td>
            <Td>
              {editing === u.id ? (
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              ) : (
                u.name
              )}
            </Td>
            <Td>
              {editing === u.id ? (
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              ) : (
                u.profile?.fullName
              )}
            </Td>
            <Td>
              {editing === u.id ? (
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              ) : (
                u.profile?.phone
              )}
            </Td>
            <Td>
              {editing === u.id ? (
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              ) : (
                u.profile?.address
              )}
            </Td>
            <Td>
              {editing === u.id ? (
                <>
                  <Button size="sm" mr={2} onClick={save}>Save</Button>
                  <Button size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" onClick={() => startEdit(u)}>Edit</Button>
              )}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
