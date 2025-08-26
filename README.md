# IP Quality for Web - API Worker 
���� [IPQuality for Web](https://github.com/HEXUXIU/IPQuality-for-Web) ��Ŀ�ĺ�� API ���񣬻��� Cloudflare Worker ���������ۺ��˶�� IP ���ݷ���Ϊǰ���ṩȫ��� IP ��Ϣ��ѯ���ܡ� 
 
## �������� 
 
- **������Դ����**: ���ɶ�� IP ���ݿ�ͷ����������� 
- **������**: ���� Cloudflare ȫ�����磬���ӳ���Ӧ 
- **��������**: ͬʱ��ѯ�������Դ����߲�ѯЧ�� 
- **��׼����Ӧ**: ͳһ�����ݸ�ʽ������ǰ�˴��� 
- **��������**: ��ֹ���ã�������˷��� 
- **������**: ���ƵĴ�������� 
 
## ����ջ 
 
- **���л���**: Cloudflare Worker 
- **����Դ**: ipinfo.io, ip-api.com, ip.sb, IPQualityScore, Scamalytics �� 
- **����**: Wrangler CLI 
 
## ���� Cloudflare Worker 
 
### ǰ������ 
 
1. Cloudflare �˻� 
2. ��װ [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/get-started/) 
3. ��¼ Wrangler: wrangler login 
 
### ������ 
 
1. ��¡�ֿ�: 
git clone https://github.com/HEXUXIU/ip-quality-for-web-api.git 
cd ip-quality-for-web-api 
2. ��װ���� (����еĻ�): 
npm install 
 
3. ���û������� (��ѡ): 
   �� Cloudflare Worker �Ǳ�����������»������������ø�������Դ�� 
   - IPQS_KEY - IPQualityScore API ��Կ 
   - IPDATA_KEY - ipdata.co API ��Կ 
   - ABUSEIPDB_KEY - AbuseIPDB API ��Կ 
 
4. ���� Cloudflare: 
wrangler deploy 
 
5. ��¼ Worker URL������ǰ������: 
   ����ɹ���Wrangler ����ʾ Worker �� URL�������� https://ip-quality-worker.your-subdomain.workers.dev 
 
## API ʹ��˵�� 
 
### ��ѯ IP ��Ϣ 
 
curl https://ip-quality-worker.your-subdomain.workers.dev/?ip=8.8.8.8 
 
## ���֤ 
 
����Ŀ���� MIT License - ��� [LICENSE](LICENSE) �ļ� 
 
����Ŀ��Ҫ��AI���ɣ�������� [xykt/IPQuality](https://github.com/xykt/IPQuality) �����˼·��Ŀ����ʹ�޷�ʹ�øýű���ϵͳҲ���Բ��ִﵽ��Ч����ԭ��Ŀ���� AGPL-3.0 ���֤����л IPQuality �ű������ߡ� 
