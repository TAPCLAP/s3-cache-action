# S3 Cache Action

Этот GitHub Action позволяет кэшировать файлы и директории в Amazon S3, что помогает ускорить процесс сборки проекта путем повторного использования ранее загруженных или собранных файлов.

## Описание

Action выполняет следующие функции:
- Сохраняет кэш в Amazon S3 bucket
- Восстанавливает кэш из Amazon S3 bucket
- Поддерживает гибкую настройку путей для кэширования
- Использует хэширование для определения изменений в кэше

## Примеры использования

### Воссановление из кеша
```yaml
    # nosemgrep
  - uses: tapclap/s3-cache-action/restore@main
    name: restore
    with:
      secretKey: ${{ secrets.S3_CACHE_ACCESS_KEY }}
      accessKey: ${{ secrets.S3_CACHE_ACCESS_KEY_ID }}
      region: ${{ vars.S3_CACHE_REGION }}
      bucket: ${{ vars.S3_CACHE_BUCKET }}
      cache-list-keys: |
      - key: path/to/object/1
        path: ./1
      - key: path/to/object/2
        path: ./2
      - key: path/to/object/3
        path: ./3

```
action пройдет по списку и попробует скачать все файлы кеша из бакета. Это могут быть как папки так и файлы

### Список в файле
```yaml
    # nosemgrep
  - uses: tapclap/s3-cache-action/restore@main
    name: restore
    with:
      secretKey: ${{ secrets.S3_CACHE_ACCESS_KEY }}
      accessKey: ${{ secrets.S3_CACHE_ACCESS_KEY_ID }}
      region: ${{ vars.S3_CACHE_REGION }}
      bucket: ${{ vars.S3_CACHE_BUCKET }}
      cache-list-keys-file: 'list.json`
```

### Сохраняем кеши
Синтаксис точно такой-же, только меняем `/save` на `/restore`
```yaml
    # nosemgrep
  - uses: tapclap/s3-cache-action/save@main
    name: restore
    with:
      secretKey: ${{ secrets.S3_CACHE_ACCESS_KEY }}
      accessKey: ${{ secrets.S3_CACHE_ACCESS_KEY_ID }}
      region: ${{ vars.S3_CACHE_REGION }}
      bucket: ${{ vars.S3_CACHE_BUCKET }}
      cache-list-keys: |
      - key: path/to/object/1
        path: ./1
      - key: path/to/object/2
        path: ./2
      - key: path/to/object/3
        path: ./3
```

## Параметры

### Обязательные параметры

| Параметр | Описание |
|----------|----------|
| `accessKey` | AWS Access Key ID для доступа к S3 |
| `secretKey` | AWS Secret Access Key для доступа к S3 |
| `region` | Регион AWS, где находится bucket |
| `bucket` | Название S3 bucket для хранения кэша |
| `cache-list-keys` | JSON/Yaml со списком ключей и путей которые требуется восстановить из кеша или залить в кеш |
| `cache-list-keys-file` | тоже самое что  `cache-list-keys`, только это путь до файла с таким списком в json/yaml формате |


## Лицензия

MIT