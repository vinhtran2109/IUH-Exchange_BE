package edu.iuh.exchange.productservice.application.service;

import org.springframework.stereotype.Service;
import java.util.Arrays;
import java.util.List;

@Service
public class ProfanityFilterService {

    // Danh sách từ ngữ bị cấm (Blacklist) cơ bản
    private static final List<String> BLACKLIST = Arrays.asList(
        "dam tac", "lua dao", "cho re", "chui boi", "shit", "fuck", "bitch", "scam"
    );

    /**
     * Dùng biểu thức chính quy (Regex) kết hợp Regex cơ bản để phát hiện từ ngữ tục tĩu
     */
    public boolean containsProfanity(String text) {
        if (text == null || text.trim().isEmpty()) return false;
        
        String lowerText = text.toLowerCase();
        
        for (String word : BLACKLIST) {
            if (lowerText.contains(word)) {
                return true;
            }
        }
        return false;
    }
}
