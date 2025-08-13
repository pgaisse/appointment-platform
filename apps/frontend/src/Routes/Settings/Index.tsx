import SetCategories from './SetCategories'
import CustomTabs from '@/Components/CustomTabs'
import GetCategories from './GetCategories'
import { useCategories } from '@/Hooks/Query/useCategories'
import { Box } from '@chakra-ui/react'
import { useDeleteItem } from '@/Hooks/Query/useDeleteItem'


function Index() {
    const { data: categories, refetch:rcategories, isLoading: islCategories, isSuccess:issCategories } = useCategories();
   const {  mutate: deleteItem } = useDeleteItem({refetch:rcategories, model:"Categories" });
    const data = [{ label: "New Priority", content: <><Box width={"100%"}><SetCategories refetchCategories={rcategories} /><GetCategories deleteItem={deleteItem} data={categories} refetch={rcategories} isloading={islCategories} isSuccess={issCategories} /></Box></> },
    { label: "tab2", content: "content tab2" }, { label: "tab3", content: "content tab3" }]

    return (
        <>
            <CustomTabs tabData={data} />

        </>
    )
}

export default Index