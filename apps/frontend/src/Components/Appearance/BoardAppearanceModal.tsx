import { useMemo, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  Tabs, TabList, TabPanels, Tab, TabPanel,
  SimpleGrid, Box, Input, HStack, Button, FormLabel, NumberInput, NumberInputField, useToast
} from '@chakra-ui/react';
import type { TopicAppearance } from '@/Hooks/useTopicAppearance';

const COLORS = [
  '#0C0F17', '#1F2937', '#111827', '#0ea5e9', '#6366f1', '#22c55e',
  '#f97316', '#ef4444', '#a855f7', '#eab308', '#14b8a6', '#94a3b8'
];

export default function BoardAppearanceModal({
  isOpen, onClose, initial, onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  initial?: TopicAppearance;
  onSave: (patch: TopicAppearance) => Promise<void> | void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [bgType, setBgType] = useState<'color'|'image'>(initial?.background?.type ?? 'color');
  const [color, setColor] = useState(initial?.background?.color ?? COLORS[0]);
  const [imageUrl, setImageUrl] = useState(initial?.background?.imageUrl ?? '');
  const [blur, setBlur] = useState(initial?.overlay?.blur ?? 0);
  const [brightness, setBrightness] = useState(initial?.overlay?.brightness ?? 1);

  const previewStyle = useMemo(() => ({
    background: bgType === 'color' ? color : `url(${imageUrl}) center/cover no-repeat`,
    filter: `blur(${blur}px) brightness(${brightness})`,
    borderRadius: '12px',
    height: '120px',
  }), [bgType, color, imageUrl, blur, brightness]);

  const save = async () => {
    try {
      await onSave({
        background: bgType === 'color'
          ? { type: 'color', color }
          : { type: 'image', imageUrl },
        overlay: { blur, brightness }
      });
      toast({ status: 'success', title: 'Board appearance updated' });
      onClose();
    } catch (e: any) {
      toast({ status: 'error', title: 'Could not save', description: e?.message || 'Error' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Board appearance</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box mb={4} borderWidth="1px" p={2} rounded="md" style={previewStyle} />
          <Tabs index={tab} onChange={setTab}>
            <TabList>
              <Tab onClick={() => setBgType('color')}>Color</Tab>
              <Tab onClick={() => setBgType('image')}>Image</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <SimpleGrid columns={6} spacing={3}>
                  {COLORS.map(c => (
                    <Box
                      key={c}
                      rounded="md"
                      h="36px"
                      bg={c}
                      borderWidth={c === color ? '3px' : '1px'}
                      borderColor={c === color ? 'blue.400' : 'transparent'}
                      cursor="pointer"
                      onClick={() => setColor(c)}
                    />
                  ))}
                </SimpleGrid>
              </TabPanel>
              <TabPanel>
                <Input placeholder="https://image.url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
              </TabPanel>
            </TabPanels>
          </Tabs>

          <HStack mt={4} spacing={6}>
            <Box>
              <FormLabel m={0}>Blur</FormLabel>
              <NumberInput min={0} max={20} value={blur} onChange={(_, v) => setBlur(Number.isNaN(v) ? 0 : v)}>
                <NumberInputField />
              </NumberInput>
            </Box>
            <Box>
              <FormLabel m={0}>Brightness</FormLabel>
              <NumberInput step={0.05} min={0.5} max={1.5} value={brightness} onChange={(_, v) => setBrightness(Number.isNaN(v) ? 1 : v)}>
                <NumberInputField />
              </NumberInput>
            </Box>
            <Button ml="auto" colorScheme="blue" onClick={save}>Save</Button>
          </HStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
