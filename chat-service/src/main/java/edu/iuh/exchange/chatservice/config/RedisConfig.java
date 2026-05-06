package edu.iuh.exchange.chatservice.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import edu.iuh.exchange.chatservice.infrastructure.messaging.RedisSubscriber;

@Configuration
public class RedisConfig {

    public static final String CHAT_TOPIC = "chat-messages";

    @Bean
    @Primary

    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        return mapper;
    }


    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory, ObjectMapper objectMapper) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer(objectMapper);

        // Key dùng String, Value dùng JSON đã cấu hình thời gian
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(serializer);
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(serializer);

        template.afterPropertiesSet();
        return template;
    }

    // 2. Cấu hình Adapter để bắn tin nhắn từ Redis Subscriber tới class RedisSubscriber
    @Bean
    public MessageListenerAdapter messageListenerAdapter(RedisSubscriber redisSubscriber) {
        // Chúng ta sẽ tự giải mã String trong RedisSubscriber để tránh lỗi ngầm của Spring
        MessageListenerAdapter adapter = new MessageListenerAdapter(redisSubscriber, "onMessage");
        adapter.setSerializer(new StringRedisSerializer());
        return adapter;
    }



    // 3. Container tổng - nơi đăng ký tất cả các Topic muốn nghe
    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            MessageListenerAdapter messageListenerAdapter) {
        
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        
        // Đăng ký Topic CHAT_TOPIC để bắt tất cả tin nhắn chat qua Pub/Sub
        container.addMessageListener(messageListenerAdapter, new ChannelTopic(CHAT_TOPIC));
        
        return container;
    }
}


