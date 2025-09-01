import { createBrowserRouter } from "react-router-dom";
import Layout from "./Layout";
import Home from "./Home/Index";
import SignIn from "./SignIn";
import Profile from "./Profile";
import Appointments from "./Appointments";
import LogOut from "./LogOut";
import AuthorizedUsers from "../Hooks/Access/AuthorizedUsers";
import AppointmentList from "./Appointments/AppointmentList";
import PriorityList from "./Appointments/PatientFinder";
import AssignedAppointments from "./Appointments/AssignedAppointments";
import Settings from "./Settings/Index";
import path from "./path";
import AppointmentManager from "./Appointments/AppointmentManager";
import CustomChat from "./Messages/CustomChat";

const router = createBrowserRouter([
  {
    path: path.root,
    element: <Layout />,
    errorElement: (
      <Layout>
        {/* <ErrorDetail /> */}
      </Layout>
    ),
    children: [
      { index: true, element: <Home /> },

      {
        path: path.signin,
        element: <AuthorizedUsers reqAuth={false} />,
        children: [{ path: "", element: <SignIn /> }],
      },

      {
        path: path.profile,
        element: <AuthorizedUsers reqAuth={true} />,
        children: [{ path: "", element: <Profile /> }],
      },

      {
        path: path.appointments,
        element: <AuthorizedUsers reqAuth={true} />,
        children: [
          { path: "", element: <Appointments /> },
          { path: "priority-list", element: <AppointmentList /> },
          { path: "Appointment-Manager", element: <AppointmentManager/> },
          { path: "patient-finder", element: <PriorityList /> },
          { path: "Assigned-appointments", element: <AssignedAppointments /> },
           
        ],
      },

       {/*
        path: path.messages,
        element: <AuthorizedUsers reqAuth={true} />,
        children: [
          { path: "", element: <CustomChat /> },
          
           
        ],
      */},

      {
        path: path.settings,
        element: <AuthorizedUsers reqAuth={true} />,
        children: [{ path: "", element: <Settings /> }],
      },

      {
        path: path.logout,
        element: <AuthorizedUsers reqAuth={true} />,
        children: [{ path: "", element: <LogOut /> }],
      },
    ],
  },
]);

export default router;
