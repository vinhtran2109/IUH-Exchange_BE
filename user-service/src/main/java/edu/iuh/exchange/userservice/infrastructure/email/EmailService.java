package edu.iuh.exchange.userservice.infrastructure.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Email Service - Gửi OTP qua SMTP
 *
 * Dùng @Async để gửi mail không block request thread.
 * Cấu hình SMTP trong application.yml (spring.mail.*)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    /**
     * Gửi OTP xác thực email đăng ký.
     * Gửi bất đồng bộ (async) để không delay response.
     */
    @Async
    public void sendOtpEmail(String toEmail, String otpCode, String userName) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(toEmail);
            message.setSubject("[IUH Exchange] Mã xác thực tài khoản của bạn");
            message.setText(buildOtpEmailBody(userName, otpCode));

            mailSender.send(message);
            log.info("[Email] OTP sent to: {}", toEmail);

        } catch (Exception e) {
            log.error("[Email] Failed to send OTP to {}: {}", toEmail, e.getMessage());
            // Không throw exception - lỗi email không nên làm fail cả request
        }
    }

    private String buildOtpEmailBody(String userName, String otp) {
        return String.format("""
                Xin chào %s,
                
                Cảm ơn bạn đã đăng ký tài khoản IUH Campus Exchange.
                
                Mã xác thực OTP của bạn là:
                
                    🔐 %s
                
                Mã này có hiệu lực trong 10 phút. Vui lòng không chia sẻ mã này với ai.
                
                Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email này.
                
                Trân trọng,
                IUH Campus Exchange Team
                """, userName, otp);
    }
}
