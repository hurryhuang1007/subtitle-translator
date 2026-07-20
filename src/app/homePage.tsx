'use client';

import { Button, Card, Container, Heading, HStack, Stack, Text } from '@chakra-ui/react';

import { toaster } from '@/com/ui/toaster';

export default function HomePage() {
  return (
    <Container maxW="container.md" py={{ base: 12, md: 20 }}>
      <Stack gap={6} align="center" textAlign="center">
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }}>
          Subtitle Translator
        </Heading>
        <Card.Root w="full" maxW="lg">
          <Card.Body>
            <Stack gap={4}>
              <Text color="fg.muted">
                Next.js + Chakra UI 项目已就绪，可以开始开发字幕翻译功能。
              </Text>
              <HStack gap={3} justify="center" flexWrap="wrap">
                <Button
                  colorPalette="blue"
                  onClick={() =>
                    toaster.success({
                      title: '欢迎使用 Subtitle Translator',
                    })
                  }
                >
                  试一下通知
                </Button>
                <Button variant="outline">开始翻译</Button>
              </HStack>
            </Stack>
          </Card.Body>
        </Card.Root>
      </Stack>
    </Container>
  );
}
