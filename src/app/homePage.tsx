'use client';

import { Button, Card, Cursor, Footer, Notification, Title } from 'animal-island-ui';

import styles from './homePage.module.scss';

export default function HomePage() {
  return (
    <Cursor>
      <div className={styles.page}>
        <main className={styles.main}>
          <Title size="large" color="brown">
            Subtitle Translator
          </Title>
          <Card color="app-blue">
            <p>Next.js + animal-island-ui 项目已就绪，可以开始开发字幕翻译功能。</p>
            <div className={styles.actions}>
              <Button
                type="primary"
                onClick={() => Notification.success('欢迎使用 Subtitle Translator')}
              >
                试一下通知
              </Button>
              <Button type="default">开始翻译</Button>
            </div>
          </Card>
        </main>
        <Footer type="sea" />
      </div>
    </Cursor>
  );
}
