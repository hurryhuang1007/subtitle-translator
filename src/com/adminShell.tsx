'use client';

import { Box, Flex, HStack, Image, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { useRequest } from 'ahooks';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropsWithChildren } from 'react';

import { ColorModeButton } from '@/com/ui/color-mode';
import { fetchStatus } from '@/service/tasks';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/settings', label: 'Settings' },
  { href: '/logs', label: 'Logs' },
];

export function AdminShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { data } = useRequest(fetchStatus, {
    pollingInterval: 5000,
    pollingWhenHidden: false,
  });

  const watching = data?.watching;
  const running = data?.running ?? 0;
  const waiting = data?.waiting ?? 0;

  return (
    <Flex h="100vh" overflow="hidden" bg="bg.subtle">
      <Box
        as="aside"
        w={{ base: '72px', md: '220px' }}
        borderRightWidth="1px"
        borderColor="border.subtle"
        px={{ base: 2, md: 4 }}
        py={6}
        flexShrink={0}
        overflowY="auto"
      >
        <ChakraLink asChild mb={6} display="block" _hover={{ opacity: 0.9 }}>
          <Link href="/dashboard" aria-label="Subtitle Translator">
            <HStack gap={3} justify={{ base: 'center', md: 'flex-start' }}>
              <Image
                src="/logo.png"
                alt=""
                boxSize={{ base: '40px', md: '44px' }}
                rounded="lg"
                flexShrink={0}
              />
              <Box display={{ base: 'none', md: 'block' }} minW={0}>
                <Text fontWeight="semibold" fontSize="sm" lineHeight="short" truncate>
                  Subtitle
                </Text>
                <Text color="fg.muted" fontSize="xs" lineHeight="short" truncate>
                  Translator
                </Text>
              </Box>
            </HStack>
          </Link>
        </ChakraLink>
        <Stack gap={2}>
          {navItems.map(item => {
            const active = pathname === item.href;
            return (
              <ChakraLink
                asChild
                key={item.href}
                px={{ base: 2, md: 3 }}
                py={2}
                rounded="md"
                bg={active ? 'bg.emphasized' : 'transparent'}
                color={active ? 'fg' : 'fg.muted'}
                fontSize={{ base: 'sm', md: 'md' }}
              >
                <Link href={item.href}>{item.label}</Link>
              </ChakraLink>
            );
          })}
        </Stack>
      </Box>
      <Flex as="main" flex="1" direction="column" minW={0} minH={0} overflow="hidden">
        <Flex
          h="56px"
          flexShrink={0}
          borderBottomWidth="1px"
          borderColor="border.subtle"
          align="center"
          justify="space-between"
          px={{ base: 4, md: 6 }}
          gap={3}
        >
          <Text color="fg.muted" fontSize="sm" truncate>
            Subtitle Translator
          </Text>
          <HStack gap={3}>
            <Text color="fg.muted" fontSize="sm" display={{ base: 'none', sm: 'block' }}>
              {watching == null
                ? '…'
                : watching
                  ? `Watching · R${running} · W${waiting}`
                  : `Idle · R${running} · W${waiting}`}
            </Text>
            <ColorModeButton />
          </HStack>
        </Flex>
        <Box
          flex="1"
          minH={0}
          overflow="auto"
          display="flex"
          flexDirection="column"
          p={{ base: 4, md: 6 }}
        >
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
