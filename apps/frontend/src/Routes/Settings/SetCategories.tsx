import CustomEntryCatForm from "@/Components/CustomTemplates/CustomEntryCatForm";
import { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";

type Props ={
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refetchCategories: (options?: RefetchOptions) => Promise<QueryObserverResult<any, Error>>
}
const PriorityForm = ({refetchCategories}:Props) => {
     const toastInfo = { title: "Patient added", description: "The patient was added successfully" }

    return (
       <CustomEntryCatForm toastInfo={toastInfo} mode={"CREATION"} refetchCategories={refetchCategories}/>
    );
};

export default PriorityForm;
