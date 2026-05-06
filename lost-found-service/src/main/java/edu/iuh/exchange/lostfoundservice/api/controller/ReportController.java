package edu.iuh.exchange.lostfoundservice.api.controller;

import edu.iuh.exchange.common.dto.ApiResponse;
import edu.iuh.exchange.lostfoundservice.domain.model.Report;
import edu.iuh.exchange.lostfoundservice.domain.repository.ReportRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final ReportRepository reportRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public ReportController(ReportRepository reportRepository, KafkaTemplate<String, Object> kafkaTemplate) {
        this.reportRepository = reportRepository;
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Sinh viên gửi Report
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Report>> createReport(
            @RequestHeader("X-User-Id") String reporterId,
            @RequestBody Report report) {
        
        report.setReporterId(reporterId);
        report.setStatus(Report.ReportStatus.PENDING);
        
        Report saved = reportRepository.save(report);
        return ResponseEntity.status(201).body(ApiResponse.created(saved));
    }

    /**
     * Admin xem danh sách Report
     */
    @GetMapping("/admin")
    public ResponseEntity<ApiResponse<Page<Report>>> getReports(
            @RequestHeader("X-User-Role") String role,
            @RequestParam(defaultValue = "PENDING") Report.ReportStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Page<Report> reports = reportRepository.findByStatus(
                status,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        return ResponseEntity.ok(ApiResponse.ok(reports));
    }

    /**
     * Admin xử lý Report (Approve / Reject)
     */
    @PatchMapping("/admin/{reportId}/resolve")
    public ResponseEntity<ApiResponse<Report>> resolveReport(
            @RequestHeader("X-User-Role") String role,
            @PathVariable String reportId,
            @RequestParam Report.ReportStatus status,
            @RequestParam(required = false) String adminNote) {
        
        return reportRepository.findById(reportId).map(report -> {
            report.setStatus(status);
            report.setAdminNote(adminNote);
            reportRepository.save(report);
            
            // Nếu admin duyệt (nghĩa là tố cáo đúng), phạt Karma người bị tố cáo
            if (status == Report.ReportStatus.APPROVED && report.getReportedUserId() != null) {
                kafkaTemplate.send("user.karma.penalty", report.getReportedUserId(), 
                        java.util.Map.of(
                                "userId", report.getReportedUserId(),
                                "pointsToDeduct", 5,
                                "reason", report.getReason()
                        ));
            }
            
            return ResponseEntity.ok(ApiResponse.ok(report));
        }).orElseGet(() -> ResponseEntity.status(404).body(ApiResponse.<Report>error(404, "Report not found")));
    }
}
