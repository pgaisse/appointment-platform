import AlertDelete from "@/Components/Alerts/AlertDelete";
import CustomEntryCatForm from "@/Components/CustomTemplates/CustomEntryCatForm";
import CustomModal from "@/Components/Modal/CustomModal";
import { useUpdateCategories } from "@/Hooks/Query/useUpdateCategories";
import {
  Box,
  Button,
  Flex,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QueryObserverResult, RefetchOptions, UseMutateFunction } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refetch:  (options?: RefetchOptions) => Promise<QueryObserverResult<any, Error>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[] | undefined;
  isloading: boolean;
  isSuccess: boolean;
  deleteItem: UseMutateFunction<unknown, Error, string, unknown>
};


function SortableRow(
  props: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refetch:(options?: any) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleteItem: UseMutateFunction<any, Error, string, unknown>;
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any;
    index: number;
    confirmDelete: (id: string) => void
  }
) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });



  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: isDragging ? "#EDF2F7" : "white", // gray.100
  };
  const toastInfo = { title: "Category edited", description: "The categorie was edited successfully" }
  
  return (
    <>
      <Tr ref={setNodeRef} style={style} _hover={{ bg: "blue.50" }} {...attributes}>
        <Td {...listeners} style={{ cursor: "grab" }}>
          {props.index + 1}
        </Td>
        <Td>{props.item.name}</Td>
        <Td>{props.item.description}</Td>
        <Td>{props.item.notes}</Td>
        <Td isNumeric>{props.item.durationHours}</Td>
        <Td>
          <Box
            w="30px"
            h="20px"
            borderRadius="md"
            bg={props.item.color || "gray.300"}
            border="1px solid"
            borderColor="gray.400"
          />
        </Td>
        <Td>
          <Button mx={5}
            colorScheme="red"
            onClick={(e) => {
              e.stopPropagation(); // evita conflicto con drag
              props.confirmDelete(props.item._id);
            }}
            ml={3}
          >
            Delete
          </Button>

          <CustomModal nameButton="Edit" size={"5xl"} >
            <CustomEntryCatForm 
            preColor={props.item.color}
            preDescription={props.item.description}
            preDurationHours={props.item.durationHours}
            preId={props.item.id}
            pre_Id={props.item._id}
            preName={props.item.name}
            preNotes={props.item.notes}
            toastInfo={toastInfo } 
            mode="EDITION" 
            refetch={props.refetch}
            />
            
            </CustomModal>
        </Td>
      </Tr>


    </>
  );
}


const GetCategories = ({ deleteItem, refetch, data, isloading, isSuccess }: Props) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [categories, setCategories] = useState<any[]>([]);
  const { mutate, isPending} = useUpdateCategories({})


  const { isOpen, onOpen, onClose } = useDisclosure();
  const [itemToDelete, setItemToDelete] = useState<string>("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirmDelete = (id: string) => {
    //console.log("esto es", id)
    setItemToDelete(id);
    onOpen();
  };

  const handleDelete = () => {
    if (deleteItem && itemToDelete) {
      deleteItem(itemToDelete);
    }
    onClose();
  };


  const toast = useToast();
  //console.log("data", data)
  useEffect(() => {
    if (data && Array.isArray(data)) {
      setCategories(data);
    } else {
      setCategories([]);
    }
    
   // console.log("output", output)
  }, [data]);


  //console.log(categories)
  const guardarOrden = () => {
    //console.log('Nuevo orden:', categories);
    const output = categories?.map((item, index) => {
      return { _id: item._id, id: index + 1 }
    })
    //console.log("output", output)
    mutate(output,
      {

        onSuccess: () => {
          toast({
            title: "Order modified",
            description: "Order successfully modified",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
          //console.log("DATOS GUARDADOS", output)
          refetch();
        },
      });
  };
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((item) => item._id === active.id);
      const newIndex = categories.findIndex((item) => item._id === over.id);
      setCategories(arrayMove(categories, oldIndex, newIndex));


    }

  };

  // Opcional: llamar refetch aquí con control para no hacerlo siempre
  // useEffect(() => {
  //   refetch();
  // }, [refetch]);

  return (
    <>
      <Box
        borderWidth="1px"
        rounded="lg"
        shadow="1px 1px 3px rgba(0,0,0,0.3)"
        maxWidth={"100%"}
        p={6}
        m="10px auto">
        {isloading && (
          <Box textAlign="center" py={10}>
            <Spinner size="xl" />
            <Text mt={4}>Cargando...</Text>
          </Box>
        )}


        {!isloading && isSuccess && categories.length > 0 && (



          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >

            <SortableContext
              items={categories.map((item) => item._id)}
              strategy={verticalListSortingStrategy}
            >
              <TableContainer
                border="1px"
                borderColor="gray.200"
                borderRadius="md"
                boxShadow="sm"
              >
                <Table variant="striped" size="md">
                  <Thead>
                    <Tr>
                      <Th>Priority</Th>
                      <Th>Name</Th>
                      <Th>Description</Th>
                      <Th>Notes</Th>
                      <Th isNumeric>Duration (hours)</Th>
                      <Th>Color</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {categories.map((item, index) => (
                      <SortableRow refetch={refetch} 
                      deleteItem={deleteItem} 
                      confirmDelete={confirmDelete} 
                      key={item._id} 
                      id={item._id} 
                      item={item} 
                      index={index} 
                      />
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </SortableContext>
            <Flex justifyContent="flex-end" p={5}>
              <Button mb={4} colorScheme="teal" isDisabled={isPending ? true : false} onClick={guardarOrden} width="150px">
                {isPending ? <Spinner size="sm" /> : "Change order"}
              </Button>
            </Flex>
          </DndContext>

        )}

        {!isloading && isSuccess && categories.length === 0 && (
          <Text textAlign="center" py={10} color="gray.500">
            No hay datos para mostrar.
          </Text>
        )}


      </Box>
      <AlertDelete cancelRef={cancelRef} handleDelete={handleDelete} isOpen={isOpen} onClose={onClose} />
    </>
  );
};

export default GetCategories;
