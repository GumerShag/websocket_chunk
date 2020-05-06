# websocket_chunk

Конвертирование видео в fragmented mp4 при помощи утилиты ffmpeg c параметрами: 'video/mp4; codecs="avc1.64001e,mp4a.40.2"' по 10 секунд.

```
./ffmpeg -y \
  -i View_From_A_Blue_Moon_Trailer-576p.mp4 \
  -force_key_frames "expr:gte(t,n_forced*2)" \
  -sc_threshold 0 \
  -s 1280x720 \
  -c:v libx264 -b:v 1500k \
  -c:a aac \
  -hls_time 10 \
  -hls_playlist_type vod \
  -hls_segment_type fmp4 \
  -hls_segment_filename "fileSequence%d.m4s" \
  prog_index.m3u8
```

Ссылка на сегментированные файлы:
https://yadi.sk/d/GTzmfyFQ2UvB3w

https://yadi.sk/d/GX6HJcCMV4REOA

server-mpeg-dash ищет сегментированные файлы в папке `./media/*`
Необходимо указать путь к папке, где лежат сегменты и начальный файл `init.mp4`


Запуск UI
```
yarn start
```
```https://localhost:{PORT}/app```

ПРОБЛЕМЫ:

1. Некоторые видео содержат неверные данные о таймстемпе кусочков, поэтому перемотка на эти части видео не работает. -> решение использовать видео файлы без ошибок
2. Нет error handling, за ошибками идем к консоль
3. Возможно иногда переполняется буффер -> решение пока нет