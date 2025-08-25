import { Button, Flex, Icon, ResponsiveValue, Skeleton, Stack, Tooltip } from '@chakra-ui/react';
import { QueryObserverResult, RefetchOptions } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { FieldError } from 'react-hook-form';
import { Priority } from '@/types';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { FiCheckCircle } from 'react-icons/fi';

type Props = {
  selected?: number
  setSelected?: React.Dispatch<React.SetStateAction<number>>
  setCatSelected?: React.Dispatch<React.SetStateAction<string>>
  refetch?: (options?: RefetchOptions) => Promise<QueryObserverResult<unknown, Error>>
  defaultBtn?: boolean;
  fontSize?: ResponsiveValue<number | string>
  isPending?: boolean;
  gap?: string;
  btnSize?: number
  value?: string;
  onChange?: (id: string, value: string, color?: string, duration?: number | null) => void;
  error?: FieldError;
};

function CustomButtonGroup({
  selected,
  isPending,
  setSelected,
  onChange,
  value,
  gap = "15px",
  setCatSelected,
  refetch,
  defaultBtn = false,
  fontSize
}: Props) {


  const query = {};
  const limit = 20;
  const { data: options, isSuccess, isFetching } = useGetCollection<Priority>("PriorityList", { query, limit });
  const updatedOptions: Priority[] = defaultBtn
    ? [{
      _id: "null",
      id: -1,
      description: "null",
      notes: "null",
      durationHours: 0,
      name: "Any",
      color: "pink",
    }, ...(options ?? [])]
    : (options ?? []);



  useEffect(() => {
    if (defaultBtn) {
      onChange?.("Any", "Any");
      setCatSelected?.("Any");
    }


  }, []);


  useEffect(() => {
    if (!selected || !updatedOptions.length) return;

    const matchedOption = updatedOptions.find(opt => opt.id === selected);
    if (matchedOption) {
      onChange?.(matchedOption._id ?? "", matchedOption.name, matchedOption.color, matchedOption.durationHours);
      setCatSelected?.(matchedOption.name);
      refetch?.();
    }
  }, [selected, updatedOptions]);


  return (
    <>
      {
        options && options.length &&
          !isFetching && isSuccess ? (
          <Flex wrap="wrap" gap={gap}>
            {updatedOptions.map((option: Priority) => {
              return (
                <Tooltip
                  key={option.id}
                  hasArrow
                  label={option.notes || option.description}
                  placement="top"
                >
                  <Button
                    isDisabled={isPending}
                    colorScheme={value === option.name ? "blue" : "gray"}
                    variant={value === option.name ? "solid" : "outline"}
                    onClick={() => {
                      onChange?.(option._id ?? "", option.name, option.color, option.durationHours);
                      if (setSelected) setSelected(option.id);
                      setCatSelected?.(option.name);
                      refetch?.();
                    }}
                    borderRadius="2xl"
                    width={{ base: "38px", md: "150px" }}
                    bgGradient={`linear(to-br, ${option.color}.500, ${option.color}.900)`}
                    minWidth={{ base: "20px", md: "150px" }}

                    color="white"
                    border={selected === option.id ? `3px solid ${option.color}` : `none`}
                    _hover={{
                      transform: "scale(1.03)",
                      bgGradient: `linear(to-br, ${option.color}.400, ${option.color}.800)`,
                      boxShadow: "xl",
                    }}
                    _active={{
                      transform: "scale(0.97)",
                      bgGradient: `linear(to-br, ${option.color}.400, ${option.color}.800)`,
                    }}
                    transition="all 0.25s ease-in-out"
                    boxShadow={selected === option.id
                      ? `0 0 0 3px white, 0 0 0 6px ${option.color}.500`
                      : "md"}
                    fontSize={fontSize}
                    data-value={option.durationHours}
                  >
                    {option.name}
                    {selected === option.id && (
                      <Icon
                        as={FiCheckCircle}
                        color="white"
                        bg={`${option.color}.600`}
                        borderRadius="full"
                        boxSize={4}
                        position="absolute"
                        top="6px"
                        right="6px"
                        boxShadow="md"
                      />
                    )}
                  </Button>

                </Tooltip>
              );
            })}
          </Flex>

        ) : (
          <Stack>
            <Skeleton height='20px' />
            <Skeleton height='20px' />
            <Skeleton height='20px' />
          </Stack>
        )}
    </>
  );
}

export default CustomButtonGroup;
