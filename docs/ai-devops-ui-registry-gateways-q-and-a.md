# Cau hoi va tra loi theo chu de: AI, DevOps, UI, Registry, WS Gateway, API Gateway

Tai lieu nay dung de on van dap va tra loi nhanh khi giang vien hoi sau vao cac phan ky thuat cua du an IUH Exchange. Moi cau tra loi nen neu duoc: muc dich, cach lam trong du an, file code minh chung, va han che/trade-off.

## 1. AI tich hop

### Cau 1: Du an co tich hop AI o dau?

Du an tich hop AI o hai luong chinh. Thu nhat la tro ly AI trong chat de nguoi dung hoi ve san pham, don hang, do that lac va nho he thong tao tin mat/nhat do. Thu hai la AI/OCR trong lost-found de phan tich anh, trich xuat thong tin vat pham va ho tro ghep cap bai mat do voi bai nhat duoc.

File lien quan:
- `frontend/src/pages/AiAssistant.tsx`
- `packages/chat-service/src/services/ai-assistant.service.js`
- `packages/lost-found-service/src/services/ai-autopost.service.js`
- `packages/lost-found-service/src/services/image-processor.service.js`
- `packages/lost-found-service/src/services/matching.service.js`

### Cau 2: AI trong du an co phai AI Agent khong?

Co. AI khong chi tra loi text don thuan ma co kha nang goi tool theo ngu canh. Khi nguoi dung hoi "tim san pham", "tim do that lac", "xem don cua toi", he thong co cac tool rieng de truy van du lieu that trong database, sau do AI tong hop cau tra loi. Vi vay day la AI Agent dang don gian theo mo hinh tool-calling.

File lien quan:
- `packages/chat-service/src/services/ai-assistant.service.js`

### Cau 3: Cac tool AI Agent hien co la gi?

Ba tool noi bat la `searchProductsTool`, `searchLostFoundTool`, va `getMyOrdersTool`. `searchProductsTool` dung de tim san pham theo tu khoa, danh muc, gia. `searchLostFoundTool` tim bai mat do/nhat duoc. `getMyOrdersTool` lay don hang cua nguoi dung hien tai.

File lien quan:
- `packages/chat-service/src/services/ai-assistant.service.js`
- `packages/chat-service/src/__tests__/ai-assistant.service.test.js`

### Cau 4: Tai sao khong de AI tu tra loi bang du lieu tuong tuong?

Neu AI tu doan, ket qua de sai va gay mat tin cay. Du an tach AI thanh phan lap luan ngon ngu va cac tool truy van du lieu that. Cach nay giup cau tra loi dua tren san pham, lost-found, don hang dang co trong he thong.

File lien quan:
- `packages/chat-service/src/services/ai-assistant.service.js`

### Cau 5: Luong AI tao bai mat do/nhat duoc hoat dong nhu the nao?

Nguoi dung nhan tin trong trang AI, co the dinh kem anh va mo ta. Frontend gui noi dung qua API. Backend phan tich noi dung, chuan hoa thanh draft lost-found gom loai tin, tieu de, mo ta, vi tri, thoi gian, thong tin lien he, anh. Sau do he thong tao bai lost-found thay vi bat nguoi dung nhap form thu cong.

File lien quan:
- `frontend/src/pages/AiAssistant.tsx`
- `frontend/src/services/lostFoundService.ts`
- `packages/lost-found-service/src/controllers/lostfound.controller.js`
- `packages/lost-found-service/src/services/ai-autopost.service.js`
- `packages/lost-found-service/src/routes/lostfound.routes.js`

### Cau 6: Neu AI khong nhan duoc vi tri ngoai cac vi tri mau thi sao?

Ve thiet ke, AI nen chap nhan vi tri tu do thay vi chi gioi han "nha H", "tang ham toa X", "thu vien". Neu user nhap "o can tin" thi service can xem day la `location` hop le. Neu AI chua du thong tin thi hoi tiep, nhung khong nen lap lai cau hoi khi user da cung cap vi tri.

File can kiem tra khi sua:
- `packages/lost-found-service/src/services/ai-autopost.service.js`
- `frontend/src/pages/AiAssistant.tsx`

### Cau 7: AI co xu ly anh khong?

Co. Lost-found service co phan xu ly anh/OCR de nhan dien loai vat pham va trich xuat thong tin nhu MSSV neu anh la the sinh vien. Tuy nhien thong tin nhay cam can duoc xu ly than trong, chi hien thi khi can thiet va co su dong y.

File lien quan:
- `packages/lost-found-service/src/services/image-processor.service.js`
- `packages/lost-found-service/src/__tests__/image-processor.service.test.js`
- `packages/lost-found-service/src/services/ai-autopost.service.js`

### Cau 8: Match lost-found dang dua tren nhung yeu to nao?

Match nen dua tren loai vat pham, tu khoa chinh, mo ta, vi tri, thoi gian va co the ca tin hieu tu anh. De tranh match qua nhieu thu khong lien quan, can tang nguong tin cay, bat buoc cung loai vat pham, va uu tien match nguoc giua LOST va FOUND thay vi match tat ca bai.

File lien quan:
- `packages/lost-found-service/src/services/matching.service.js`
- `packages/lost-found-service/src/__tests__/matching.service.test.js`

### Cau 9: Tai sao nen bo o "ket qua phan tich AI" tren trang chi tiet lost-found?

Vi nguoi dung cuoi can thong tin de hanh dong: vat gi, mat/nhat o dau, lien he ai. O ket qua AI co the gay roi, lam lo thong tin nhay cam, va khong can thiet neu da dung AI de tao noi dung bai. Ket qua AI nen dung noi bo de ho tro match va kiem duyet, khong can dat thanh section lon tren UI.

File lien quan:
- `frontend/src/pages/LostFoundDetail.tsx`

### Cau 10: AI co bao mat khong?

AI khong nen xu ly mat khau, OTP, token, thong tin ngan hang. Neu xu ly anh the sinh vien, can tranh phoi bay so giay to hoac MSSV khong can thiet. Cac request van di qua JWT va API Gateway nen AI khong duoc truy cap don hang cua nguoi khac.

File lien quan:
- `packages/api-gateway/src/middleware/auth-filter.js`
- `packages/chat-service/src/services/ai-assistant.service.js`
- `packages/lost-found-service/src/services/image-processor.service.js`

### Cau 11: AI duoc test nhu the nao?

AI duoc test o muc service/controller. Test tap trung vao viec tool tra ve ket qua dung, fallback khi AI loi, va luong phan tich lost-found khong lam hong du lieu chinh.

File lien quan:
- `packages/chat-service/src/__tests__/ai-assistant.service.test.js`
- `packages/chat-service/src/__tests__/ai-assistant.controller.test.js`
- `packages/lost-found-service/src/__tests__/image-processor.service.test.js`
- `packages/lost-found-service/src/__tests__/matching.service.test.js`

### Cau 12: Neu Gemini/API AI bi loi thi he thong co dung duoc khong?

Co. AI la tinh nang ho tro, khong phai core bat buoc. Neu AI loi, nguoi dung van co the dang bai, tim san pham, tao lost-found bang form binh thuong. Backend nen co fallback de tao draft don gian tu noi dung user nhap.

File lien quan:
- `packages/lost-found-service/src/services/ai-autopost.service.js`
- `frontend/src/pages/AiAssistant.tsx`

## 2. DevOps

### Cau 13: Du an deploy bang cach nao?

Du an co Docker Compose de chay toan bo stack va co pipeline GitHub Actions de build, test, push image, sau do deploy len server/Kubernetes. Moi service co Dockerfile rieng hoac build target rieng.

File lien quan:
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `Dockerfile.api-gateway`
- `Dockerfile.ws-gateway`
- `Dockerfile.frontend`

### Cau 14: Docker Compose chay nhung thanh phan nao?

Docker Compose gom API Gateway, WS Gateway, frontend, cac service nghiep vu nhu user/product/order/notification/chat/lost-found, MongoDB, Redis, Nginx, Prometheus/Grafana tuy cau hinh. Compose giup chay local va deploy don gian tren VM.

File lien quan:
- `docker-compose.yml`

### Cau 15: Tai sao dung Docker Compose thay vi chay tung service bang npm?

Vi du an la multi-service. Docker Compose giup dong bo network, env, port, Redis, MongoDB va cac service phu tro. Chay tung service bang npm de bi lech moi truong va kho deploy len server.

File lien quan:
- `docker-compose.yml`

### Cau 16: CI/CD cua du an lam gi?

CI kiem tra code, cai dependency, build/test cac package. Deploy workflow build Docker images, dang nhap registry, push image va cap nhat deployment. Muc tieu la giam loi thu cong va dam bao moi lan deploy co dau vet commit.

File lien quan:
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

### Cau 17: Neu `npm ci` loi lockfile thi y nghia gi?

Nghia la `package.json` va `package-lock.json` khong dong bo. CI dung `npm ci` de cai dung lockfile, nen khi them package phai chay `npm install` de cap nhat lockfile roi commit ca hai file.

File lien quan:
- `package.json`
- `package-lock.json`
- `packages/common/package.json`

### Cau 18: He thong co health check khong?

Co. Cac service/gateway co endpoint health de Docker/Kubernetes/Nginx kiem tra trang thai. API Gateway co `/health`, `/health/live`, `/health/ready`, va metrics.

File lien quan:
- `packages/api-gateway/src/index.js`
- `docker-compose.yml`
- `k8s/base/deployments.yaml`

### Cau 19: He thong giam downtime bang cach nao?

Giam downtime bang restart policy, health check, reverse proxy Nginx, readiness/liveness probe tren Kubernetes, rolling update va PodDisruptionBudget. Khi mot container loi, orchestrator co the restart hoac rut khoi load balancing.

File lien quan:
- `docker-compose.yml`
- `infra/nginx/nginx.conf`
- `k8s/base/deployments.yaml`
- `k8s/base/pdb.yaml`

### Cau 20: Co monitoring khong?

Co cau hinh Prometheus/Grafana de thu thap metrics va quan sat tinh trang he thong. API Gateway cung expose metrics de theo doi request, loi, latency.

File lien quan:
- `infra/monitoring/prometheus.yml`
- `infra/monitoring/grafana/provisioning/datasources/prometheus.yml`
- `packages/api-gateway/src/index.js`

### Cau 21: Deploy HTTPS o dau?

HTTPS va proxy public duoc cau hinh o Nginx. Nginx nhan request domain, proxy frontend, API va WebSocket ve cac service noi bo.

File lien quan:
- `infra/nginx/nginx.conf`
- `docker-compose.yml`

### Cau 22: Bien moi truong duoc quan ly nhu the nao?

Du an dung `.env` cho local/server va `.env.example` de tai lieu hoa cac bien can co. Secrets nhu JWT, Mongo URI, Redis, Firebase credential khong nen hard-code trong source.

File lien quan:
- `.env.example`
- `docker-compose.yml`

### Cau 23: Firebase JSON dung o dau?

Firebase service account JSON dung cho backend khi can Firebase Admin SDK, vi du xu ly notification hoac upload/quan ly tai nguyen lien quan Firebase. File nay nen mount qua Docker/secret va khong commit vao Git.

File can kiem tra:
- `docker-compose.yml`
- `.env.example`

### Cau 24: Neu server AWS sap dung luong dia thi xu ly sao?

Can kiem tra Docker image/container/log, prune image cu co kiem soat, tang EBS volume, va dat log rotation. Voi app deploy bang Docker, image build moi va log co the chiem dung luong nhanh.

Lenh tham khao tren server:
- `docker system df`
- `docker image ls`
- `docker logs --tail=100 <container>`

## 3. Giao dien

### Cau 25: Frontend dung stack gi?

Frontend dung React, TypeScript, Vite, Tailwind CSS, component style theo shadcn/ui va Lucide Icons. Cach nay giup build nhanh SPA, component hoa man hinh va de deploy static qua Nginx.

File lien quan:
- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/index.css`

### Cau 26: Cac route frontend nam o dau?

Route chinh nam trong `App.tsx`. O day khai bao cac trang nhu trang chu, cua hang, chi tiet san pham, lost-found, AI Assistant, admin dashboard, moderation dashboard, order detail.

File lien quan:
- `frontend/src/App.tsx`

### Cau 27: Layout chung nam o dau?

Layout chung gom header, navigation, chuong thong bao, chat popup, user menu nam trong component layout.

File lien quan:
- `frontend/src/components/Layout.tsx`
- `frontend/src/components/ChatManager.tsx`
- `frontend/src/components/ChatWindow.tsx`
- `frontend/src/components/ChatList.tsx`

### Cau 28: Vi sao can real-time chat va notification?

Vi nguoi dung can thay tin nhan/thong bao ngay nhu Messenger, khong phai F5. Chat va notification real-time giup giao dich nhanh hon, tranh bo lo tranh chap, don hang, match lost-found va tin nhan nguoi mua/ban.

File lien quan:
- `frontend/src/services/chatService.ts`
- `frontend/src/components/ChatManager.tsx`
- `packages/ws-gateway/src/index.js`
- `packages/chat-service/src/index.js`

### Cau 29: UI admin va moderation co khac nhau khong?

Co. Admin co quyen toan cuc: quan ly user, role, dashboard, don hang, tranh chap, report, audit. Moderator chi tap trung kiem duyet bai, lost-found, report va khoa/ban neu co quyen. UI moderation nen it muc hon, tap trung vao tac vu can xu ly.

File lien quan:
- `frontend/src/pages/AdminDashboard.tsx`
- `frontend/src/pages/ModerationDashboard.tsx`
- `frontend/src/services/adminService.ts`

### Cau 30: Vi sao phai hien thi ten that thay vi ObjectId tren UI?

ObjectId huu ich cho database nhung kho hieu voi quan tri vien. UI can hien ten, MSSV, email, san pham, trang thai. ObjectId chi nen rut gon hoac dat trong chi tiet ky thuat.

File lien quan:
- `frontend/src/pages/AdminDashboard.tsx`
- `frontend/src/pages/ModerationDashboard.tsx`
- `frontend/src/pages/OrderDetail.tsx`

### Cau 31: Cac service API frontend nam o dau?

Frontend tach API thanh cac service rieng de de bao tri: auth, product, order, lost-found, chat, admin. File `api.ts` chua axios instance, token, refresh token, interceptor.

File lien quan:
- `frontend/src/services/api.ts`
- `frontend/src/services/productService.ts`
- `frontend/src/services/orderService.ts`
- `frontend/src/services/lostFoundService.ts`
- `frontend/src/services/chatService.ts`
- `frontend/src/services/adminService.ts`

### Cau 32: Frontend co client-side rate limiter khong?

Co the co logic gioi han/chan goi API lap lai o client hoac interceptor. Tuy nhien day chi la lop bao ve UX, khong thay the rate limiter phia API Gateway/server.

File lien quan:
- `frontend/src/services/api.ts`

### Cau 33: Khi access token het han thi frontend lam gi?

Frontend dung interceptor de refresh token. Neu refresh thanh cong thi goi lai request cu. Neu refresh fail thi logout/dua ve login. Loi `:8080 refresh-token timeout` thuong do frontend dang goi sai base URL hoac goi truc tiep port khong public.

File lien quan:
- `frontend/src/services/api.ts`

### Cau 34: UI san pham/lost-found can uu tien dieu gi?

Can uu tien anh ro, ten san pham/vat pham noi bat, gia/trang thai/vi tri de quet nhanh, thong tin nguoi dang that, va CTA nhu mua, chat, bao cao. Khong nen de anh bi crop qua manh hoac section rong khong co gia tri.

File lien quan:
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/ProductDetail.tsx`
- `frontend/src/pages/LostFoundDetail.tsx`

### Cau 35: PWA/service worker co trong du an khong?

Co thanh phan public cho PWA/service worker. Neu dung khong dung cach, service worker co the cache asset cu lam UI khong cap nhat ngay. Khi deploy frontend moi can dam bao cache strategy hop ly.

File lien quan:
- `frontend/public/sw.js`
- `frontend/public/manifest.json`

## 4. Registry

### Cau 36: Registry trong du an la gi?

Registry la noi luu Docker image sau khi build. Du an dung GitHub Container Registry (GHCR) de luu image cua tung service, vi du API Gateway, WS Gateway, chat-service, lost-found-service, frontend.

File lien quan:
- `.github/workflows/deploy.yml`

### Cau 37: Registry khac GitHub repository nhu the nao?

GitHub repository luu source code. Registry luu Docker image da build san. Khi deploy, server/Kubernetes chi can pull image tu registry thay vi build lai source tren server.

File lien quan:
- `.github/workflows/deploy.yml`

### Cau 38: Image duoc tag nhu the nao?

Workflow thuong tag image theo commit SHA va `latest`. Tag theo SHA giup rollback va truy vet phien ban chinh xac; tag latest tien cho deploy nhanh nhung it ro rang hon.

File lien quan:
- `.github/workflows/deploy.yml`

### Cau 39: Ai co quyen push image len registry?

GitHub Actions dang nhap GHCR bang `GITHUB_TOKEN` hoac secret duoc cau hinh. Quyen push phu thuoc repository permission va workflow permission.

File lien quan:
- `.github/workflows/deploy.yml`

### Cau 40: Cac image nao can co trong registry?

Moi service deploy rieng nen co image rieng: api-gateway, ws-gateway, user-service, product-service, order-service, notification-service, chat-service, lost-found-service, frontend.

File lien quan:
- `.github/workflows/deploy.yml`
- `k8s/base/deployments.yaml`

### Cau 41: Tai sao khong build tren EC2 moi lan deploy?

Build tren EC2 lam deploy cham, ton CPU/RAM, kho rollback. Build tren CI va push registry giup server chi pull image da test, on dinh va co the rollback theo tag.

File lien quan:
- `.github/workflows/deploy.yml`

### Cau 42: Khi registry loi thi anh huong gi?

Neu image da co tren server thi container cu van chay. Nhung deploy moi co the fail vi khong pull duoc image. Cach giam rui ro la giu image cu, dung tag SHA, va khong xoa image dang duoc deploy.

File lien quan:
- `.github/workflows/deploy.yml`

## 5. WS Gateway

### Cau 43: WS Gateway dung de lam gi?

WS Gateway la cong realtime rieng cho WebSocket/SockJS/STOMP. No tach traffic realtime khoi HTTP API, giup chat va notification hoat dong on dinh hon, de cau hinh proxy va scale rieng.

File lien quan:
- `packages/ws-gateway/src/index.js`
- `Dockerfile.ws-gateway`
- `docker-compose.yml`

### Cau 44: Vi sao can WS Gateway thay vi cho frontend noi truc tiep chat-service?

Neu frontend noi truc tiep chat-service, se lo topology noi bo va kho quan ly CORS, auth, sticky session, TLS. WS Gateway tao mot entry point realtime duy nhat, de Nginx/API Gateway proxy va quan ly ket noi.

File lien quan:
- `packages/ws-gateway/src/index.js`
- `infra/nginx/nginx.conf`

### Cau 45: Frontend ket noi WS o dau?

Frontend ket noi qua chat service client, thuong dung SockJS/STOMP, co reconnect, heartbeat va subscribe cac queue/topic.

File lien quan:
- `frontend/src/services/chatService.ts`
- `frontend/src/components/ChatManager.tsx`

### Cau 46: Cac kenh STOMP chinh la gi?

Nguoi dung subscribe queue rieng de nhan tin nhan va thong bao, vi du `/user/queue/messages`, `/user/queue/notifications`. Khi gui tin nhan, client publish len destination nhu `/app/chat`, `/app/chat.image`, `/app/typing`.

File lien quan:
- `frontend/src/services/chatService.ts`
- `packages/ws-gateway/src/services/socket.service.js`

### Cau 47: WS Gateway xac thuc nguoi dung nhu the nao?

Token JWT duoc gui khi ket noi hoac trong header/query. Gateway/service kiem tra token de biet user nao dang ket noi, tu do gui message vao user queue dung nguoi.

File lien quan:
- `packages/ws-gateway/src/index.js`
- `packages/ws-gateway/src/services/socket.service.js`
- `packages/api-gateway/src/middleware/auth-filter.js`

### Cau 48: Heartbeat va reconnect de lam gi?

Heartbeat giup phat hien ket noi chet. Reconnect giup client tu noi lai sau khi mat mang/ngat server tam thoi. Neu khong co, chat/thong bao se chi hien sau khi F5.

File lien quan:
- `frontend/src/services/chatService.ts`

### Cau 49: Nginx proxy WebSocket nhu the nao?

Nginx can proxy `/ws/` ve WS Gateway va giu cac header upgrade/connection de WebSocket hoat dong. Neu cau hinh sai, trinh duyet se bao lost connection hoac fallback SockJS loi.

File lien quan:
- `infra/nginx/nginx.conf`

### Cau 50: WS Gateway scale co kho khong?

Co. WebSocket la ket noi lau dai nen khi scale nhieu instance can can nhac sticky session hoac message broker pub/sub. Hien tai co the dung sticky session/ip_hash voi Nginx; neu scale lon hon nen dung Redis pub/sub hoac broker de dong bo message giua instances.

File lien quan:
- `infra/nginx/nginx.conf`
- `packages/ws-gateway/src/index.js`

### Cau 51: Vi sao thong bao real-time van co the chua hien ngay?

Co the do client chua subscribe dung queue, token WS cu, server chi tao notification trong DB nhung khong publish qua WS, hoac state frontend khong merge notification moi vao dropdown. Can kiem tra ca backend emit va frontend listener.

File lien quan:
- `frontend/src/services/chatService.ts`
- `frontend/src/components/Layout.tsx`
- `packages/notification-service/src`
- `packages/ws-gateway/src`

## 6. API Gateway

### Cau 52: API Gateway trong du an lam gi?

API Gateway la cong vao HTTP chinh. No route request tu frontend den service dung, xu ly JWT, CORS, security headers, rate limit, circuit breaker, logging, metrics va health check.

File lien quan:
- `packages/api-gateway/src/index.js`
- `packages/api-gateway/src/config/routes.js`
- `packages/api-gateway/src/middleware/auth-filter.js`
- `packages/api-gateway/src/middleware/circuit-breaker.js`
- `packages/api-gateway/src/middleware/request-logger.js`

### Cau 53: Tai sao can API Gateway trong kien truc microservices?

Neu frontend goi truc tiep tung service, se phai biet port/noi bo cua moi service, auth lap lai, CORS phuc tap va kho rate limit. API Gateway gom tat ca thanh mot endpoint cong khai, che giau noi bo va ap dung policy tap trung.

File lien quan:
- `packages/api-gateway/src/index.js`
- `packages/api-gateway/src/config/routes.js`

### Cau 54: API Gateway route request nhu the nao?

Gateway doc cau hinh route, nhan path `/api/v1/...`, xac dinh service dich, proxy request sang service noi bo. Mot so route public cho xem san pham/lost-found, cac route thay doi du lieu yeu cau token.

File lien quan:
- `packages/api-gateway/src/config/routes.js`
- `packages/api-gateway/src/index.js`

### Cau 55: API Gateway co auth JWT khong?

Co. Middleware auth kiem tra JWT, xac dinh user, role, permission. Sau do gateway forward thong tin can thiet sang service phia sau de service tiep tuc xu ly authorization.

File lien quan:
- `packages/api-gateway/src/middleware/auth-filter.js`

### Cau 56: Public route va protected route khac nhau the nao?

Public route cho phep truy cap khong token, vi du login/register hoac xem danh sach san pham cong khai. Protected route yeu cau JWT, vi du tao don hang, dang bai, chat, quan tri, moderation.

File lien quan:
- `packages/api-gateway/src/config/routes.js`
- `packages/api-gateway/src/middleware/auth-filter.js`

### Cau 57: Gateway co rate limiter khong?

Co. Gateway co the gioi han request global, auth route, route nhay cam, dung Redis store de dong bo counter giua instance. Day la lop bao ve chinh chong spam va qua tai.

File lien quan:
- `packages/api-gateway/src/index.js`

### Cau 58: Circuit breaker dung de lam gi?

Circuit breaker giup gateway khong tiep tuc goi mot service dang loi lien tuc. Khi service loi qua nguong, breaker mo, request bi tra ve nhanh hoac fallback. Sau mot thoi gian, breaker thu lai xem service da hoi phuc chua.

File lien quan:
- `packages/api-gateway/src/middleware/circuit-breaker.js`

### Cau 59: Gateway co logging request khong?

Co. Request logger ghi nhan request ID, method, path, status, latency de debug va audit. Request ID giup lan theo mot request qua nhieu service.

File lien quan:
- `packages/api-gateway/src/middleware/request-logger.js`

### Cau 60: Gateway co metrics khong?

Co. Gateway expose metrics de Prometheus scrape, giup theo doi so request, latency, loi va suc khoe he thong.

File lien quan:
- `packages/api-gateway/src/index.js`
- `infra/monitoring/prometheus.yml`

### Cau 61: API Gateway va Nginx khac nhau the nao?

Nginx la reverse proxy/edge proxy, xu ly domain, HTTPS, static frontend va proxy vao backend. API Gateway la ung dung Node.js nam sau Nginx, xu ly routing nghiep vu, auth, rate limit, circuit breaker va logging cho API.

File lien quan:
- `infra/nginx/nginx.conf`
- `packages/api-gateway/src/index.js`

### Cau 62: Neu API Gateway chet thi sao?

Neu chi co mot instance thi API se downtime. De tang availability, can chay nhieu replica API Gateway, dat sau Nginx/load balancer, co health check va rolling update. Kubernetes co the ho tro replica, readiness/liveness probe.

File lien quan:
- `k8s/base/deployments.yaml`
- `k8s/base/services.yaml`
- `infra/nginx/nginx.conf`

### Cau 63: API Gateway co nen xu ly business logic khong?

Khong nen. Gateway chi nen xu ly cross-cutting concerns: auth, route, rate limit, logging, circuit breaker. Business logic nhu order, product, lost-found nen nam trong service rieng de tranh gateway phinh to thanh monolith.

File lien quan:
- `packages/api-gateway/src/index.js`
- `packages/product-service/src`
- `packages/order-service/src`
- `packages/lost-found-service/src`

### Cau 64: Gateway bao ve service noi bo nhu the nao?

Service noi bo khong can expose truc tiep ra Internet. Frontend chi goi domain public, request di qua Nginx va API Gateway. Gateway kiem tra token, rate limit va route, giup giam nguy co truy cap trai phep vao tung service.

File lien quan:
- `docker-compose.yml`
- `infra/nginx/nginx.conf`
- `packages/api-gateway/src/index.js`

## 7. Cau hoi tong hop de tra loi khi bi hoi xoay

### Cau 65: Neu traffic tang dot bien thi uu tien scale phan nao?

Uu tien scale API Gateway, frontend/Nginx, product-service va chat/ws neu traffic doc/real-time tang. Neu nghen database thi toi uu index, cache Redis va giam query nang. Voi WebSocket, can tinh sticky session hoac broker de scale ngang.

File lien quan:
- `k8s/base/hpa.yaml`
- `k8s/base/deployments.yaml`
- `infra/nginx/nginx.conf`

### Cau 66: Neu chat real-time loi nhung API van chay thi nguoi dung co bi dung hoan toan khong?

Khong. Chat real-time la mot luong rieng qua WS Gateway. Neu WS loi, nguoi dung van co the dung cac API khac nhu xem san pham, tao don, lost-found. Tuy nhien UX chat/thong bao bi giam, nen can fallback fetch danh sach tin nhan/thong bao khi reconnect.

File lien quan:
- `frontend/src/services/chatService.ts`
- `packages/ws-gateway/src/index.js`
- `packages/api-gateway/src/index.js`

### Cau 67: Neu Redis loi thi he thong bi anh huong gi?

Redis anh huong cache, rate limit, session/pubsub neu co. Core CRUD van co the tiep tuc neu service truy MongoDB truc tiep, nhung performance va bao ve spam giam. Can cau hinh fallback can than va monitor Redis.

File lien quan:
- `docker-compose.yml`
- `packages/api-gateway/src/index.js`

### Cau 68: Neu AI match sai lost-found thi giam rui ro the nao?

Khong tu dong ket luan vat pham la cung mot vat. Chi gui thong bao "co the khop", hien do tin cay, cho nguoi dung doi chieu anh/mo ta/vi tri/thoi gian. Tang threshold va bat buoc cung loai vat pham de giam false positive.

File lien quan:
- `packages/lost-found-service/src/services/matching.service.js`
- `frontend/src/pages/LostFoundDetail.tsx`

### Cau 69: Neu giang vien hoi diem manh kien truc cua du an la gi?

Diem manh la tach service theo domain, co API Gateway/WS Gateway rieng, co Docker Compose/CI/CD/registry, co realtime chat/notification, co AI Agent va lost-found matching. Kien truc nay phu hop ung dung co nhieu luong nghiep vu: mua ban, don hang, chat, moderation, lost-found.

File lien quan:
- `docker-compose.yml`
- `packages/api-gateway/src`
- `packages/ws-gateway/src`
- `packages/chat-service/src/services/ai-assistant.service.js`

### Cau 70: Diem yeu/chua toi uu cua du an la gi?

Do phuc tap cao hon monolith, can quan ly nhieu service/env/log. WebSocket scale can broker/sticky session. AI co rui ro sai ket qua nen can fallback va nguong tin cay. Neu chua co observability day du, viec debug loi lien service se kho hon.

File lien quan:
- `docker-compose.yml`
- `infra/monitoring/prometheus.yml`
- `packages/ws-gateway/src`
- `packages/lost-found-service/src/services/matching.service.js`

### Cau 71: Vi sao kien truc nay phu hop hon monolith cho IUH Exchange?

IUH Exchange co nhieu domain doc lap: user, product, order, chat, notification, lost-found, admin/moderation, AI. Tach service giup moi phan co the scale, test va deploy rieng. Tuy nhien neu team nho, monolith se don gian hon. Du an chon microservices de phu hop muc tieu mon hoc kien truc va kha nang mo rong.

File lien quan:
- `packages/`
- `docker-compose.yml`

### Cau 72: Neu duoc cai tien tiep, nen lam gi?

Nen them message broker cho realtime/event, centralized logging, tracing, backup MongoDB, Redis HA, canary/blue-green deploy, role/permission audit ro hon, va cai thien AI evaluation de do do chinh xac matching lost-found.

File lien quan:
- `infra/monitoring/`
- `k8s/base/`
- `packages/lost-found-service/src/services/matching.service.js`
