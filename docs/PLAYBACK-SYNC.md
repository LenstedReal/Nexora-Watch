# PLAYBACK-SYNC

## Protokol (WS `/api/ws?code=&participant_id=&token=`)
İstemci → sunucu
- `{"type":"ping","client_time":ms}` her 10 sn (açılışta 3 kez)
- `{"type":"playback","playing":bool,"position":s,"seq":int,"media_id":str,"sent_at":serverMs}` (yalnız host)
- `{"type":"message","text":str,"client_id":uuid}` · `{"type":"reaction","emoji":str}` · `{"type":"buffering","buffering":bool}`

Sunucu → istemci
- `hello {room, participant_id, server_time}` · `room {room}` · `playback {playback, server_time, cmd_sent_at, seq, stale?}`
- `message` · `presence` · `peer_state` · `reaction` · `pong {client_time, server_time}` · `error {code, detail}` · `room_closed`
- Kapanış kodları: 4000 başka soketle değiştirildi, 4403 yetkisiz, 4404 oda yok, 4410 oda kapandı/süresi doldu.

`playback` nesnesi (geriye uyumlu): `{playing, position, updated_at(serverMs), revision, media_id, updated_by}`.

## Kurallar
- Sunucu `seq` değeri `last_seq`'ten büyük ve `media_id` güncel değilse komutu uygulamaz (`stale:true`).
- İstemci yalnızca `revision` büyükse state'i kabul eder.
- Beklenen konum = `position + (now + offset − updated_at)/1000` (playing ise). `offset` = en düşük RTT'li pong örneğinden.
- Misafir: buffering sırasında düzeltme yok; |sapma| > 2 sn → seek(+0,15 sn), 3 sn cooldown; 0,25–2 sn → hız 0,95–1,05 (yalnız HTML/AVPlayer/Media3). YouTube: yalnız seek.
- Host: buffering asla `playing=false` yazmaz; 1 sn yerel kontrol, uyumsuzluk > 0,75 sn veya 20 sn keepalive'da yayın.
- Autoplay engellenirse "Senkrona katılmak için dokun" düğmesi.

## Ölçüm
`POST /api/rooms/{code}/metrics` örnekleri; `GET /api/rooms/{code}/metrics/summary` → katılımcı başına `avg_drift_s`, `max_drift_s`, `over_2s`, `avg_rtt_ms`, `avg_command_latency_ms`, `corrections`, `reconnects`, `player_errors`, `buffering_ms`.
İki fiziksel telefonla test **henüz yapılmadı**; prosedür `TESTING.md`.
