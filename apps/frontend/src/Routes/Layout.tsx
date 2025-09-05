import Header from "@/Components/Header";
import SideBar from "@/Components/SideBar";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Grid,
  GridItem
} from "@chakra-ui/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FaRegCalendarCheck, FaUserCircle } from 'react-icons/fa';
import {
  FiCalendar,
  FiHome
} from "react-icons/fi";
import { IoSettingsOutline } from "react-icons/io5";
import { LuUserRoundSearch } from "react-icons/lu";
import { HiOutlineClipboardDocumentCheck } from "react-icons/hi2";

import { TbCalendarPlus, TbSortAscendingSmallBig } from "react-icons/tb";
import { Outlet } from "react-router-dom";

import paths from "./path";  // <-- Importa las rutas centralizadas
import { SocketNotification } from "@/Components/Socket/SocketNotification";
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { MdTextsms } from "react-icons/md";
import { LinkItem } from "@/types";


const Layout = () => {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [linkSession, setLinkSession] = useState<LinkItem[]>([]);
  
  const [linkConfig, setLinkConfig] = useState<LinkItem[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLinkItems([
        { name: "Home", icon: FiHome, path: paths.root, color: "blue.500" },
        // { name: "Profile", icon: FiUser, path: paths.profile, color: "cyan.600" },
      ]);
      setLinkSession([
        { name: "Sign in", icon: FaUserCircle, path: paths.signin, color: "pink.300" },
      ]);
    } else if (!isLoading && isAuthenticated) {
      //{ name: "SMS Center", icon: MdTextsms, path: paths.messages, color: "black.500" },
      setLinkItems([
        { name: "Home", icon: FiHome, path: paths.root, color: "blue.500" },
        { name: "New Patient", icon: TbCalendarPlus, path: paths.appointments, color: "green.500" },
        { name: "Priority List", icon: FiCalendar, path: paths.appointmentList, color: "orange.400" },
        { name: "Appointment Manager", icon: HiOutlineClipboardDocumentCheck, path: paths.appointmentManager, color: "cyan.600" },
        { name: "Patient Finder", icon: LuUserRoundSearch, path: paths.patientFinder, color: "purple.500" },
        { name: "Appointments", icon: FaRegCalendarCheck, path: paths.assignedAppointments, color: "teal.500" },
        { name: "SMS Center", icon: MdTextsms, path: paths.messages, color: "black.500" },
        { name: "Organizer", icon: TbSortAscendingSmallBig, path: paths.organizer, color: "black.500" },
       
        

      ]);
      setLinkConfig([
         { name: "Settings", icon: IoSettingsOutline, path: paths.settings, color: "black.500" },
      ])
      setLinkSession([
        { name: `${user?.name}`, icon: FaUserCircle, path: "", color: "pink.300" },
        { name: "Log out", icon: FaUserCircle, path: paths.logout, color: "pink.300" },
      ]);
    }
  }, [isAuthenticated, isLoading, user]);

  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(0);

  useLayoutEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, []);

  return (
    <Grid
      templateAreas={`"header header"
                      "nav main"`}
      gridTemplateRows={"70px 1fr"}
      gridTemplateColumns={{ base: "0 1fr", md: "200px 1fr" }}
      transition="all 0.3s ease"
      gap="1"
      color="blackAlpha.700"
      fontWeight="bold"
      bg={"gray.200"}
    >
      <GridItem
        pl="2"
        area="header"
        //position="fixed"
        top="0"
        ref={headerRef} // 
        left="0"
        width="100%"
        zIndex="999"
      >
        <Header linkItems={linkItems} linkSession={linkSession} />
      </GridItem>

      <GridItem
        pl="2"
        area={"nav"}
        height={`calc(100vh - ${headerHeight}px)`}
        overflow="hidden"
        transition="all 0.3s ease"
        display={{ base: "none", md: "block" }}
        bg={"white"}
      >
        <SideBar linkItems={linkItems} linkConfig={linkConfig} />
      </GridItem>

      <GridItem pl="2" area={"main"} bg={"white"} height={`calc(100vh - ${headerHeight}px)`} >
        {<SocketNotification />}
        <Outlet />
    </GridItem>
    </Grid >
  );
};

export default Layout;
