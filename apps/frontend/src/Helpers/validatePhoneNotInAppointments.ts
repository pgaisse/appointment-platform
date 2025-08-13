// ✅ Este archivo ya NO usa useAuth0
import axios from "axios";

export const validatePhoneNotInAppointments = async (phone: string, token: string): Promise<boolean> => {
  const res = await axios.get(`${import.meta.env.VITE_APP_SERVER}/query/Appointment`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      query: JSON.stringify({ phoneInput: phone }),
      projection: JSON.stringify({ phoneInput: 1 }),
      limit: 1,
    },
  });

  return Array.isArray(res.data) && res.data.length === 0;
};
