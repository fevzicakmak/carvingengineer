# Fevzi Çakmak · Taş Heykel

Görsel, video ve 3B model galerisi. Derleme gerektirmez. Örnek görseller kuş sarayı tasarım çalışmalarıdır. Örnek MP4, Roma tasarım görselinden hazırlanmıştır.

## Yerel çalışma

Bu dizinde `python3 -m http.server 8000` çalıştırıp `http://localhost:8000` adresini açın. `admin.html` galeri yönetimi içindir. Taslak, kullanılan tarayıcıdaki IndexedDB’de saklanır.

## GitHub Pages

1. Dosyaları yeni `fevzicakmak/carvingengineer` deposunun `main` dalının köküne aktarın. GitHub Pages için depo görünürlüğünün planınıza uygun olduğundan emin olun.
2. **Settings → Pages → Build and deployment → Deploy from a branch** altında `main` ve `/(root)` seçin. İlk dağıtımı GitHub’ın gösterdiği adreste kontrol edin.
3. GitHub hesabınızın **Settings → Pages** bölümünde `carvingengineer.com` alan adı doğrulamasını başlatın. GoDaddy DNS’ine GitHub’ın verdiği TXT kaydını ekleyin ve doğrulamayı tamamlayın.
4. Depoda **Settings → Pages → Custom domain** alanına `carvingengineer.com` girin. GoDaddy’de `@` için siteyi gösteren eski A/AAAA kayıtlarını GitHub’ın verdiği kayıtlarla değiştirin. IPv4 kayıtları `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. `www` için CNAME hedefi `fevzicakmak.github.io`. E-posta kayıtlarını koruyun. DNS doğrulaması ve sertifika tamamlanınca **Enforce HTTPS** seçeneğini açın.
5. Ana alanı ve www adresini tarayıcıda kontrol edin. Özel alan adı, GitHub Pages tarafından ayarlanırken `CNAME` dosyası GitHub tarafından eklenir.

## Galeriyi güncelleme

- `admin.html` adresindeki **Galeri yönetimi** üzerinden görsel veya video ekleyin, dosyayı değiştirin, açıklama yazın, öğeyi sıralayın veya silin.
- **Taslağı önizle** ile aynı tarayıcıda sonucu görün.
- Yönetim ekranını açmak ve yayımlamak için `fevzicakmak/carvingengineer` deposuna ve yalnızca o depoya yazma izni olan fine-grained GitHub token (Contents: Read and write) girin. Anahtar GitHub’da hesap sahibi doğrulaması için kullanılır ve yalnızca açık yönetim sekmesinin belleğinde tutulur. Yüklenen dosyaların gereksiz EXIF bilgilerini yayımdan önce kaldırın.
- Yayım tek Git commit’i oluşturur. Kaldırılan öğe siteden kalkar. Daha önce yayımlanmış kopyalar Git geçmişinde kalabilir.
- Görsel sınırı 8 MB, video sınırı 20 MB. Video için H.264 kodlamalı MP4 en geniş telefon desteğini sağlar.
