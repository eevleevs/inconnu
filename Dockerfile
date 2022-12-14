FROM denoland/deno:alpine
WORKDIR /home/app
COPY vendor vendor
COPY providers providers
COPY *.ts .
CMD deno run --allow-env --allow-net --allow-read --import-map=vendor/import_map.json mod.ts