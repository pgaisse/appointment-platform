import React from 'react'
import { Box, Tab, TabList, TabPanel, TabPanels, Tabs, TabProps } from '@chakra-ui/react'

type TabItem = {
    label: string;
    content: React.ReactNode;
};

type Props = TabProps & {
    tabData: TabItem[]
    activeTab?: number;
    onChange?: (index: number) => void;
}
function index({ tabData = [] }: Props) {
    return (
        <Box>
            <Tabs>
                <TabList>
                    {tabData.length > 1
                        ? tabData.map((item, number: number) => {
                            return (<Tab key={`${number}- Tab`}>{item.label}</Tab>);
                        })
                        : <Tab></Tab>}
                </TabList>

                <TabPanels>


                    {tabData.length > 1
                        ? tabData.map((item, number: number) => {
                            return (<TabPanel key={`${number}- TabPanel`}>{item.content}</TabPanel>);
                        })
                        : ""}

                </TabPanels>
            </Tabs>

        </Box>
    )
}

export default index